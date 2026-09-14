from pathlib import Path

from sqlalchemy import exists, or_
from sqlalchemy.orm import joinedload, selectinload
from werkzeug.utils import secure_filename

from app import db
from app.config import Config
from app.models import Activity, Document, DocumentChunk, Module, Procedure
from app.service.extract_service import (
    document_to_preview_html,
    extract_tsd_from_file,
    load_paged_text,
    page_for_content,
    tags_from_filename,
)


def parse_id(value):
    if value in (None, "", "all"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def list_documents(
    module_id=None,
    procedure=None,
    title=None,
    document_code=None,
    version=None,
    q=None,
):
    query = Document.query.options(
        joinedload(Document.module),
        selectinload(Document.linked_procedures),
    )
    parsed_module = parse_id(module_id)
    if parsed_module is not None:
        query = query.filter(Document.module_id == parsed_module)
    if title:
        query = query.filter(Document.title.ilike(f"%{title.strip()}%"))
    if document_code:
        query = query.filter(Document.document_code.ilike(f"%{document_code.strip()}%"))
    if version:
        query = query.filter(Document.version.ilike(f"%{version.strip()}%"))
    if procedure:
        term = f"%{procedure.strip()}%"
        query = query.filter(
            Document.linked_procedures.any(Procedure.name.ilike(term))
        )
    if q:
        term = f"%{q.strip()}%"
        module_match = exists().where(Module.id == Document.module_id, Module.name.ilike(term))
        query = query.filter(
            or_(
                Document.title.ilike(term),
                Document.document_code.ilike(term),
                Document.version.ilike(term),
                Document.file_name.ilike(term),
                module_match,
                Document.linked_procedures.any(Procedure.name.ilike(term)),
            )
        )
    return query.distinct().order_by(Document.upload_at.desc()).all()


def list_document_filters():
    versions = [
        row[0]
        for row in db.session.query(Document.version)
        .filter(Document.version.isnot(None), Document.version != "")
        .distinct()
        .order_by(Document.version.asc())
        .all()
    ]
    codes = [
        row[0]
        for row in db.session.query(Document.document_code)
        .filter(Document.document_code.isnot(None), Document.document_code != "")
        .distinct()
        .order_by(Document.document_code.asc())
        .all()
    ]
    modules = Module.query.order_by(Module.name.asc()).all()
    procedures = Procedure.query.order_by(Procedure.name.asc()).all()
    return {
        "modules": [item.to_dict() for item in modules],
        "procedures": [{"id": str(item.id), "name": item.name} for item in procedures],
        "versions": versions,
        "documentCodes": codes,
    }


def get_document(document_id):
    parsed = parse_id(document_id)
    if parsed is None:
        return None
    return db.session.get(Document, parsed)


def create_activity(event: str, detail: str, color: str = "#60a5fa"):
    activity = Activity(event=event, detail=detail, color=color)
    db.session.add(activity)
    return activity


def default_module() -> Module:
    module = Module.query.filter(Module.name.ilike("Umum")).first()
    if module:
        return module
    module = Module.query.order_by(Module.id.asc()).first()
    if module:
        return module
    module = Module(name="Umum")
    db.session.add(module)
    db.session.flush()
    return module


def get_or_create_module(name: str | None) -> Module:
    cleaned = (name or "").strip()
    if not cleaned:
        return default_module()
    existing = Module.query.filter(Module.name.ilike(cleaned)).first()
    if existing:
        return existing
    module = Module(name=cleaned.upper() if len(cleaned) <= 8 else cleaned)
    db.session.add(module)
    db.session.flush()
    return module


def get_or_create_procedure(name: str) -> Procedure:
    cleaned = (name or "").strip()
    existing = Procedure.query.filter(Procedure.name.ilike(cleaned)).first()
    if existing:
        return existing
    procedure = Procedure(name=cleaned)
    db.session.add(procedure)
    db.session.flush()
    return procedure


def _validate_docx(filename: str) -> str:
    ext = Path(filename or "").suffix.lstrip(".").lower()
    if ext != "docx":
        raise ValueError("Hanya file .docx yang didukung. PDF dan jenis lain tidak bisa diunggah.")
    return ext


def _unlink_quietly(path: Path | None) -> None:
    if not path:
        return
    try:
        if path.exists():
            path.unlink()
    except OSError:
        pass


def apply_tsd_metadata(document: Document, metadata: dict) -> None:
    module = get_or_create_module(metadata.get("module_name"))
    document.module_id = module.id
    if metadata.get("document_code"):
        document.document_code = metadata["document_code"]
    if metadata.get("version"):
        document.version = metadata["version"]
    if metadata.get("tags"):
        document.tags = metadata["tags"]
    if metadata.get("tables"):
        document.table_catalog = metadata["tables"]

    linked = []
    seen = set()
    for name in metadata.get("procedures") or []:
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        linked.append(get_or_create_procedure(name))
    document.linked_procedures = linked
    document.procedure_count = len(linked)


def save_upload(file_storage, module_id=None) -> Document:
    original_name = Path(file_storage.filename or "dokumen.docx").name
    if not original_name.lower().endswith(".docx"):
        original_name = f"{original_name}.docx"
    ext = _validate_docx(original_name)

    parsed_module_id = parse_id(module_id)
    module = db.session.get(Module, parsed_module_id) if parsed_module_id else default_module()

    upload_dir = Path(Config.UPLOAD_FOLDER)
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = secure_filename(original_name) or f"dokumen.{ext}"
    temp_name = f"tmp_{safe_name}"
    temp_path = upload_dir / temp_name
    file_storage.save(str(temp_path))

    document = Document(
        title=original_name,
        description=None,
        module_id=module.id if module else None,
        file_name=original_name,
        file_url=str(temp_path),
        size=temp_path.stat().st_size,
        type=ext,
        status="processing",
        tags=tags_from_filename(original_name),
    )
    db.session.add(document)
    db.session.flush()

    stored_path = upload_dir / f"{document.id}_{safe_name}"
    temp_path.replace(stored_path)
    document.file_url = str(stored_path)
    db.session.commit()

    try:
        _process_document(document)
        document.status = "ready"
        document.error_message = None
        create_activity("Dokumen diproses", document.title, "#34d399")
    except Exception as exc:
        document.status = "error"
        document.error_message = str(exc)
        create_activity("Gagal memproses dokumen", document.title, "#ef4444")

    create_activity("Dokumen diupload", document.title, "#fbbf24")
    db.session.commit()
    return document


def preview_document(document_id) -> dict | None:
    document = get_document(document_id)
    if not document:
        return None
    html = ""
    error = None
    if document.file_url and Path(document.file_url).exists():
        try:
            html = document_to_preview_html(document.file_url, document.type)
        except Exception as exc:
            error = str(exc)
    else:
        error = "File fisik tidak ditemukan"
    payload = document.to_dict()
    payload["html"] = html
    payload["previewError"] = error
    return payload


def _process_document(document: Document):
    doc_id = document.id
    file_url = document.file_url
    doc_type = document.type
    file_name = document.file_name or document.title

    from app.service.rag_service import ingest_document

    ingest_document(doc_id)

    db.session.remove()
    document = db.session.get(Document, doc_id)
    if document is None:
        raise ValueError("Dokumen tidak ditemukan setelah ingest")

    metadata = extract_tsd_from_file(file_url, doc_type, file_name)
    apply_tsd_metadata(document, metadata)
    if document.file_name:
        document.title = document.file_name


def repair_stored_page_numbers() -> None:
    from sqlalchemy.orm.attributes import flag_modified

    from app.models import ChatMessage, DocumentChunk

    docs = Document.query.filter(Document.status == "ready").all()
    page_map: dict[int, list[tuple[int, str]]] = {}
    for document in docs:
        if not document.file_url or not Path(document.file_url).exists():
            continue
        distinct_chunk_pages = (
            db.session.query(DocumentChunk.page)
            .filter(DocumentChunk.document_id == document.id)
            .distinct()
            .count()
        )
        already_mapped = (document.pages or 0) > 1 and distinct_chunk_pages > 1
        if already_mapped:
            continue
        try:
            total_pages, pages = load_paged_text(document.file_url, document.type)
        except Exception:
            continue
        document.pages = max(total_pages, 1)
        if not pages:
            continue
        page_map[document.id] = pages
        chunks = DocumentChunk.query.filter_by(document_id=document.id).all()
        for chunk in chunks:
            chunk.page = page_for_content(chunk.content or "", pages)

    for message in ChatMessage.query.filter(ChatMessage.role == "assistant").all():
        sources = list(message.sources or [])
        if not sources:
            continue
        if any(int(source.get("page") or 1) > 1 for source in sources):
            continue
        updated = []
        changed = False
        for source in sources:
            excerpt = source.get("excerpt") or ""
            page = source.get("page")
            chunk = None
            snippet = excerpt[:40].rstrip(".")
            if snippet:
                chunk = (
                    DocumentChunk.query.filter(DocumentChunk.content.ilike(f"%{snippet}%"))
                    .order_by(DocumentChunk.id.asc())
                    .first()
                )
            if chunk is not None:
                page = chunk.page
            elif excerpt and page_map:
                combined = [item for pages in page_map.values() for item in pages]
                page = page_for_content(excerpt, combined)
            next_source = {**source, "page": page or 1}
            if next_source.get("page") != source.get("page"):
                changed = True
            updated.append(next_source)
        if changed:
            message.sources = updated
            flag_modified(message, "sources")


def repair_table_catalogs() -> None:
    docs = Document.query.filter(Document.status == "ready").all()
    for document in docs:
        catalog = document.table_catalog or {}
        if catalog.get("source") or catalog.get("target"):
            continue
        if not document.file_url or not Path(document.file_url).exists():
            continue
        try:
            metadata = extract_tsd_from_file(
                document.file_url,
                document.type,
                document.file_name or document.title,
            )
        except Exception:
            continue
        if metadata.get("tables"):
            document.table_catalog = metadata["tables"]


def delete_document(document_id) -> bool:
    document = get_document(document_id)
    if not document:
        return False

    title = document.display_name
    file_url = document.file_url

    try:
        DocumentChunk.query.filter_by(document_id=document.id).delete(synchronize_session=False)
        document.linked_procedures = []
        db.session.delete(document)
        create_activity("Dokumen dihapus", title, "#ef4444")
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    if file_url:
        _unlink_quietly(Path(file_url))
    return True


def dashboard_summary():
    docs = list_documents()
    total_docs = len(docs)
    total_procedures = Procedure.query.count()
    total_pages = sum(d.pages or 0 for d in docs)
    total_size = sum(d.size or 0 for d in docs)
    ready = sum(1 for d in docs if d.status == "ready")

    tag_counts: dict[str, int] = {}
    for doc in docs:
        for tag in doc.tags or []:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    top_tags = [
        {"tag": tag, "count": count}
        for tag, count in sorted(tag_counts.items(), key=lambda item: -item[1])[:8]
    ]

    activities = Activity.query.order_by(Activity.created_at.desc()).limit(8).all()

    return {
        "totalDocs": total_docs,
        "totalProcedures": total_procedures,
        "totalPages": total_pages,
        "totalSize": total_size,
        "ready": ready,
        "topTags": top_tags,
        "recentActivity": [a.to_dict() for a in activities],
        "documents": [d.to_dict() for d in docs[:8]],
    }
