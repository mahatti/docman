import hashlib
import os
import re
import warnings

import requests
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.documents import Document as LCDocument
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.retrievers import BaseRetriever
from pydantic import Field
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from sqlalchemy import or_

from app import db
from app.config import BASE_DIR, Config
from app.models import Document, DocumentChunk
from app.service.extract_service import (
    count_procedures,
    format_table_catalog,
    load_paged_text,
    annotate_table_labels,
    table_question_role,
)

TABLE_RULES = (
    "Jika pertanyaan tentang tabel, bedakan dengan ketat:\n"
    "- Tabel sumber = bagian Table Source / 3.b.1 Table Source.\n"
    "- Tabel target = bagian Target Table / Table Target / 3.b.3 Table Target.\n"
    "- Jangan mencampur sumber dan target. Jangan mengisi dari Data Models atau daftar kolom "
    "kecuali nama tabel itu muncul di bagian Source/Target.\n"
    "- Jika ada katalog tabel di konteks, utamakan katalog itu.\n"
)


def _system_prompt(document_name: str | None = None) -> str:
    if document_name:
        scope = (
            f'Konteks ini HANYA dari dokumen "{document_name}". '
            "Jangan memakai atau mencampur informasi dari dokumen lain. "
            "Jika informasi tidak tersedia dalam dokumen yang dipilih, katakan demikian dan jangan merujuk halaman. "
        )
    else:
        scope = (
            "Konteks bisa berasal dari beberapa dokumen. "
            "Sebutkan nama dokumen sumber jika relevan. "
            "Jika informasi tidak tersedia dalam konteks dokumen yang diberikan, katakan demikian dan jangan merujuk halaman. "
        )
    return (
        "Anda adalah asisten DocMan. Jawab hanya berdasarkan konteks dokumen. "
        + scope
        + "Gunakan bahasa Indonesia yang jelas. "
        "Sebutkan nama dokumen dan halaman jika relevan. "
        "Format poin penting dengan markdown **tebal**.\n"
        + TABLE_RULES
        + "\n{context}"
    )
                 


DOCUMENT_PROMPT = PromptTemplate.from_template("[{doc_name} | halaman {page}]\n{page_content}")

TIKTOKEN_VOCAB_URLS = (
    "https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken",
    "https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken",
)


def ensure_tiktoken_cache() -> None:
    cache_dir = BASE_DIR / ".tiktoken_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("TIKTOKEN_CACHE_DIR", str(cache_dir))
    for url in TIKTOKEN_VOCAB_URLS:
        cache_path = cache_dir / hashlib.sha1(url.encode()).hexdigest()
        if cache_path.exists():
            continue
        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()
        except requests.RequestException:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                response = requests.get(url, timeout=60, verify=False)
            response.raise_for_status()
        cache_path.write_bytes(response.content)


def get_embeddings() -> OpenAIEmbeddings:
    if not Config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY belum di-set di backend/.env")
    ensure_tiktoken_cache()
    return OpenAIEmbeddings(
        model=Config.OPENAI_EMBEDDING_MODEL,
        api_key=Config.OPENAI_API_KEY,
    )


def get_llm() -> ChatOpenAI:
    if not Config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY belum di-set di backend/.env")
    ensure_tiktoken_cache()
    return ChatOpenAI(
        model=Config.OPENAI_MODEL,
        temperature=0.2,
        api_key=Config.OPENAI_API_KEY,
    )


def load_file(file_path: str, file_type: str, doc_name: str) -> tuple[int, list[LCDocument]]:
    total_pages, pages = load_paged_text(file_path, file_type)
    docs = [
        LCDocument(
            page_content=annotate_table_labels(text),
            metadata={"doc_name": doc_name, "page": page, "source": file_path},
        )
        for page, text in pages
        if text.strip()
    ]
    return max(total_pages, 1), docs or [
        LCDocument(page_content="", metadata={"doc_name": doc_name, "page": 1})
    ]


def ingest_document(document_id: int) -> None:
    document = db.session.get(Document, document_id)
    if document is None:
        raise ValueError("Dokumen tidak ditemukan saat ingest")

    doc_id = document.id
    file_url = document.file_url
    doc_type = document.type
    doc_name = document.display_name

    total_pages, raw_docs = load_file(file_url, doc_type, doc_name)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=Config.CHUNK_SIZE,
        chunk_overlap=Config.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    splits = [item for item in splitter.split_documents(raw_docs) if item.page_content.strip()]
    if not splits:
        raise ValueError("Tidak ada teks yang bisa diekstrak dari dokumen.")

    # Long network call — drop the session so the ORM instance cannot go stale.
    embeddings = get_embeddings().embed_documents([item.page_content for item in splits])
    db.session.remove()

    DocumentChunk.query.filter_by(document_id=doc_id).delete(synchronize_session=False)
    for index, (split, vector) in enumerate(zip(splits, embeddings)):
        page = int(split.metadata.get("page") or 1)
        db.session.add(
            DocumentChunk(
                document_id=doc_id,
                page=max(page, 1),
                chunk_index=index,
                content=split.page_content.strip(),
                embedding=vector,
            )
        )

    document = db.session.get(Document, doc_id)
    if document is None:
        raise ValueError("Dokumen tidak ditemukan saat ingest")
    document.pages = total_pages
    document.procedure_count = count_procedures("\n".join(item.page_content for item in splits))


class DocManVectorRetriever(BaseRetriever):
    document_id: int | None = None
    k: int = 6
    extra_terms: list[str] = Field(default_factory=list)

    def _get_relevant_documents(self, query: str) -> list[LCDocument]:
        query_vector = get_embeddings().embed_query(query)
        query_set = (
            db.session.query(DocumentChunk)
            .join(Document)
            .filter(Document.status == "ready")
            .filter(DocumentChunk.embedding.isnot(None))
        )
        if self.document_id:
            query_set = query_set.filter(DocumentChunk.document_id == self.document_id)

        vector_chunks = (
            query_set.order_by(DocumentChunk.embedding.cosine_distance(query_vector))
            .limit(self.k)
            .all()
        )
        chunks = list(vector_chunks)
        seen = {chunk.id for chunk in chunks}
        if self.extra_terms:
            keyword_filter = or_(*[DocumentChunk.content.ilike(f"%{term}%") for term in self.extra_terms])
            keyword_chunks = (
                query_set.filter(keyword_filter)
                .order_by(DocumentChunk.embedding.cosine_distance(query_vector))
                .limit(self.k)
                .all()
            )
            for chunk in keyword_chunks:
                if chunk.id in seen:
                    continue
                seen.add(chunk.id)
                chunks.append(chunk)
        results = []
        for chunk in chunks:
            doc_name = chunk.document.display_name if chunk.document else "Dokumen"
            results.append(
                LCDocument(
                    page_content=chunk.content,
                    metadata={
                        "doc_name": doc_name,
                        "page": chunk.page,
                        "document_id": chunk.document_id,
                    },
                )
            )
        return results


def _document_mentioned(document: Document, question: str) -> bool:
    qcompact = re.sub(r"[^a-z0-9]+", "", (question or "").lower())
    if len(qcompact) < 6:
        return False
    candidates = [document.document_code, document.title, document.file_name]
    for raw in candidates:
        if not raw:
            continue
        compact = re.sub(r"[^a-z0-9]+", "", raw.lower())
        if len(compact) >= 8 and compact in qcompact:
            return True
        core = compact
        if raw and "-" in raw:
            core = re.sub(r"[^a-z0-9]+", "", raw.split("-", 1)[-1].lower())
        if len(core) >= 8 and core in qcompact:
            return True
    return False


def _catalog_context_docs(question: str, document_id: int | None) -> list[LCDocument]:
    query = Document.query.filter(Document.status == "ready")
    if document_id:
        query = query.filter(Document.id == document_id)
    documents = query.all()
    mentioned = [item for item in documents if _document_mentioned(item, question)]
    if mentioned:
        documents = mentioned
    docs = []
    for document in documents:
        text = format_table_catalog(document.table_catalog, question, document.display_name)
        if not text:
            continue
        docs.append(
            LCDocument(
                page_content=text,
                metadata={
                    "doc_name": document.display_name,
                    "page": "katalog",
                    "document_id": document.id,
                    "catalog": True,
                },
            )
        )
    return docs


def _table_search_terms(question: str) -> list[str]:
    role = table_question_role(question)
    if role == "source":
        return ["Table Source", "TABEL SUMBER", "3.b.1"]
    if role == "target":
        return ["Target Table", "Table Target", "TABEL TARGET", "3.b.3"]
    if role == "both":
        return ["Table Source", "Target Table", "TABEL SUMBER", "TABEL TARGET"]
    return []


UNAVAILABLE_IN_CONTEXT_RE = re.compile(
    r"(informasi tidak (tersedia|ada|ditemukan|terdapat).{0,40}(konteks|dokumen yang (diberikan|dipilih))"
    r"|tidak (tersedia|ada|ditemukan|terdapat) (dalam|di|pada) (konteks|dokumen yang (diberikan|dipilih))"
    r"|di luar konteks dokumen"
    r"|bukan bagian dari konteks dokumen)",
    re.IGNORECASE,
)


def answer_lacks_document_context(answer: str) -> bool:
    return bool(UNAVAILABLE_IN_CONTEXT_RE.search(answer or ""))


def answer_question(question: str, document_id: int | None = None) -> tuple[str, list[dict]]:
    scoped_document = None
    if document_id:
        scoped_document = Document.query.filter_by(status="ready", id=document_id).first()
        if not scoped_document:
            return (
                "Dokumen yang dipilih belum siap atau tidak ditemukan. Pilih dokumen lain, lalu tanyakan lagi.",
                [],
            )
    elif not Document.query.filter_by(status="ready").count():
        return (
            "Belum ada dokumen siap yang bisa dipakai untuk menjawab. Unggah dokumen terlebih dahulu, lalu tanyakan lagi.",
            [],
        )

    terms = _table_search_terms(question)
    retrieve_k = Config.RETRIEVE_K + 4 if terms else Config.RETRIEVE_K
    retriever = DocManVectorRetriever(document_id=document_id, k=retrieve_k, extra_terms=terms)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", _system_prompt(scoped_document.display_name if scoped_document else None)),
            ("human", "{input}"),
        ]
    )
    combine_docs_chain = create_stuff_documents_chain(
        get_llm(),
        prompt,
        document_prompt=DOCUMENT_PROMPT,
    )
    retrieved = retriever.invoke(question)
    if document_id:
        retrieved = [
            item
            for item in retrieved
            if int(item.metadata.get("document_id") or 0) == document_id
        ]
    catalog_docs = _catalog_context_docs(question, document_id) if terms else []
    context_docs = catalog_docs + list(retrieved)
    db.session.remove()
    result = combine_docs_chain.invoke({"input": question, "context": context_docs})
    answer = (result if isinstance(result, str) else (result.get("answer") or "")).strip()
    sources = []
    seen = set()
    for item in retrieved:
        doc_name = item.metadata.get("doc_name") or "Dokumen"
        page = int(item.metadata.get("page") or 1)
        excerpt = (item.page_content or "").strip().replace("\n", " ")
        if len(excerpt) > 160:
            excerpt = excerpt[:160].rstrip() + "..."
        key = (doc_name, page, excerpt[:40])
        if key in seen:
            continue
        seen.add(key)
        sources.append({"docName": doc_name, "page": page, "excerpt": excerpt})
        if len(sources) >= 4:
            break
    if answer_lacks_document_context(answer):
        return answer, []
    return answer, sources
