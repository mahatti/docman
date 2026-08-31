from pathlib import Path

import hashlib
import os
import warnings

import requests
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document as LCDocument
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.retrievers import BaseRetriever
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app import db
from app.config.config import BASE_DIR, Config
from app.models.document_model import Document, DocumentChunk
from app.service.extract_service import count_procedures, read_file_text

SYSTEM_PROMPT = (
    "Anda adalah asisten DocMan. Jawab hanya berdasarkan konteks dokumen. "
    "Gunakan bahasa Indonesia yang jelas. Jika informasi tidak ada di konteks, katakan demikian. "
    "Sebutkan nama dokumen dan halaman jika relevan. Format poin penting dengan markdown **tebal**.\n\n"
    "{context}"
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


def load_file(file_path: str, file_type: str, doc_name: str) -> list[LCDocument]:
    ext = (file_type or Path(file_path).suffix.lstrip(".")).lower()
    if ext == "pdf":
        loaded = PyPDFLoader(file_path).load()
        docs = []
        for item in loaded:
            page = int(item.metadata.get("page", 0)) + 1
            docs.append(
                LCDocument(
                    page_content=item.page_content,
                    metadata={"doc_name": doc_name, "page": page, "source": file_path},
                )
            )
        return docs or [LCDocument(page_content="", metadata={"doc_name": doc_name, "page": 1})]
    if ext in {"txt", "docx"}:
        content = read_file_text(file_path, ext)
        return [
            LCDocument(
                page_content=content,
                metadata={"doc_name": doc_name, "page": 1, "source": file_path},
            )
        ]
    if ext == "doc":
        raise ValueError("Format .doc lama tidak didukung. Unggah ulang sebagai .docx atau PDF.")
    raise ValueError(f"Tipe file tidak didukung: {ext}")


def ingest_document(document: Document) -> None:
    raw_docs = load_file(document.file_url, document.type, document.title)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=Config.CHUNK_SIZE,
        chunk_overlap=Config.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    splits = [item for item in splitter.split_documents(raw_docs) if item.page_content.strip()]
    if not splits:
        raise ValueError("Tidak ada teks yang bisa diekstrak dari dokumen.")

    embeddings = get_embeddings().embed_documents([item.page_content for item in splits])
    DocumentChunk.query.filter_by(document_id=document.id).delete()

    pages = set()
    for index, (split, vector) in enumerate(zip(splits, embeddings)):
        page = int(split.metadata.get("page") or 1)
        pages.add(page)
        db.session.add(
            DocumentChunk(
                document_id=document.id,
                page=page,
                chunk_index=index,
                content=split.page_content.strip(),
                embedding=vector,
            )
        )

    document.pages = max(pages) if pages else 1
    document.procedures = count_procedures("\n".join(item.page_content for item in splits))


class DocManVectorRetriever(BaseRetriever):
    document_id: int | None = None
    k: int = 6

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

        chunks = (
            query_set.order_by(DocumentChunk.embedding.cosine_distance(query_vector))
            .limit(self.k)
            .all()
        )
        results = []
        for chunk in chunks:
            doc_name = chunk.document.title if chunk.document else "Dokumen"
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


def answer_question(question: str, document_id: int | None = None) -> tuple[str, list[dict]]:
    ready = Document.query.filter_by(status="ready").count()
    if document_id:
        ready = Document.query.filter_by(status="ready", id=document_id).count()
    if not ready:
        return (
            "Belum ada dokumen siap yang bisa dipakai untuk menjawab. Unggah dokumen terlebih dahulu, lalu tanyakan lagi.",
            [],
        )

    retriever = DocManVectorRetriever(document_id=document_id, k=Config.RETRIEVE_K)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", "{input}"),
        ]
    )
    combine_docs_chain = create_stuff_documents_chain(
        get_llm(),
        prompt,
        document_prompt=DOCUMENT_PROMPT,
    )
    rag_chain = create_retrieval_chain(retriever, combine_docs_chain)
    result = rag_chain.invoke({"input": question})
    answer = (result.get("answer") or "").strip()
    sources = []
    seen = set()
    for item in result.get("context") or []:
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
    return answer, sources
