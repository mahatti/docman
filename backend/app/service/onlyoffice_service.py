"""ONLYOFFICE Docs editor config and save-callback handling."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from flask import request
from sqlalchemy import update
from sqlalchemy.orm import joinedload, selectinload

from app import db
from app.config import Config
from app.models import Document
from app.service import document_service

logger = logging.getLogger(__name__)

# Document Server statuses that mean "download and save"
_SAVE_STATUSES = {2, 6}

# Forcesave callers wait on these until callback finishes applying the file.
_pending_saves: dict[str, dict] = {}
_pending_lock = threading.Lock()


def _jwt_enabled() -> bool:
    secret = (os.getenv("ONLYOFFICE_JWT_SECRET") or Config.ONLYOFFICE_JWT_SECRET or "").strip()
    return bool(secret)


def _jwt_secret() -> str:
    return (os.getenv("ONLYOFFICE_JWT_SECRET") or Config.ONLYOFFICE_JWT_SECRET or "").strip()


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _encode_jwt(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    body = dict(payload)
    body.setdefault("iat", int(time.time()))
    segments = [
        _b64url(json.dumps(header, separators=(",", ":"), ensure_ascii=False).encode("utf-8")),
        _b64url(json.dumps(body, separators=(",", ":"), ensure_ascii=False).encode("utf-8")),
    ]
    signing_input = ".".join(segments).encode("ascii")
    signature = hmac.new(_jwt_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{segments[0]}.{segments[1]}.{_b64url(signature)}"


def _decode_jwt(token: str) -> dict:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise ValueError("Format token JWT tidak valid") from exc

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected = hmac.new(_jwt_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
    actual = _b64url_decode(signature_b64)
    if not hmac.compare_digest(expected, actual):
        raise ValueError("Tanda tangan JWT ONLYOFFICE tidak valid")

    payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Payload JWT tidak valid")
    nested = payload.get("payload")
    if isinstance(nested, dict) and ("status" in nested or "url" in nested or "key" in nested):
        return nested
    return payload


def document_key(document: Document) -> str:
    path = Path(document.file_url) if document.file_url else None
    mtime = 0
    if path and path.exists():
        try:
            mtime = int(path.stat().st_mtime)
        except OSError:
            mtime = 0
    raw = f"{document.id}-{mtime}-{document.size or 0}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def _public_url(path: str) -> str:
    base = Config.BACKEND_PUBLIC_URL.rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


def build_editor_payload(document: Document) -> dict:
    if not document.file_url or not Path(document.file_url).exists():
        raise ValueError("File fisik dokumen tidak ditemukan")
    if (document.type or "").lower() != "docx" and not document.display_name.lower().endswith(".docx"):
        raise ValueError("Hanya dokumen DOCX yang dapat diedit di ONLYOFFICE")
    if document.status == "processing":
        raise ValueError("Dokumen sedang diproses. Tunggu hingga status siap sebelum mengedit.")

    title = document.display_name
    key = document_key(document)
    content_url = _public_url(f"/api/documents/{document.id}/onlyoffice/content")
    callback_url = _public_url(f"/api/documents/{document.id}/onlyoffice/callback")

    config = {
        "documentType": "word",
        "document": {
            "fileType": "docx",
            "key": key,
            "title": title,
            "url": content_url,
            "permissions": {
                "edit": True,
                "download": True,
                "print": True,
                "review": True,
            },
        },
        "editorConfig": {
            "mode": "edit",
            "lang": "id",
            "callbackUrl": callback_url,
            "user": {
                "id": "docman-user",
                "name": "DocMan User",
            },
            "customization": {
                "autosave": True,
                "forcesave": True,
                "compactHeader": False,
                "feedback": False,
            },
        },
        "height": "100%",
        "width": "100%",
        "type": "desktop",
    }

    if _jwt_enabled():
        config["token"] = _encode_jwt(config)

    return {
        "documentServerUrl": Config.ONLYOFFICE_URL,
        "documentId": str(document.id),
        "documentName": title,
        "documentKey": key,
        "config": config,
    }


def request_forcesave(document_id, document_key_value: str) -> dict:
    key = (document_key_value or "").strip()
    if not key:
        raise ValueError("Document key ONLYOFFICE tidak ditemukan")

    payload = {
        "c": "forcesave",
        "key": key,
        "userdata": f"docman-{document_id}",
    }
    if _jwt_enabled():
        payload["token"] = _encode_jwt(payload)

    endpoints = [
        f"{Config.ONLYOFFICE_URL}/coauthoring/CommandService.ashx",
        f"{Config.ONLYOFFICE_URL}/command",
    ]
    last_network_error = None
    for endpoint in endpoints:
        try:
            response = requests.post(endpoint, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json() if response.content else {}
            error_code = data.get("error")
            if error_code in (None, 0):
                return {"error": 0, "key": key, "message": "Perintah simpan dikirim ke ONLYOFFICE"}
            if error_code == 4:
                return {"error": 4, "key": key, "message": "Tidak ada perubahan untuk disimpan"}
            if error_code == 1:
                raise ValueError(
                    "Sesi editor tidak ditemukan. Pastikan dokumen masih terbuka di editor, lalu coba lagi."
                )
            raise ValueError(f"ONLYOFFICE forcesave gagal (kode {error_code})")
        except requests.RequestException as exc:
            last_network_error = exc
            continue

    raise ValueError(f"Gagal menghubungi ONLYOFFICE Command Service: {last_network_error}")


def _register_pending_save(document_id) -> threading.Event:
    event = threading.Event()
    with _pending_lock:
        _pending_saves[str(document_id)] = {
            "event": event,
            "ok": False,
            "message": None,
            "document": None,
        }
    return event


def _finish_pending_save(
    document_id,
    ok: bool,
    message: str,
    document_payload: dict | None = None,
) -> None:
    with _pending_lock:
        pending = _pending_saves.get(str(document_id))
        if not pending:
            return
        pending["ok"] = ok
        pending["message"] = message
        pending["document"] = document_payload
        pending["event"].set()


def _pop_pending_save(document_id) -> dict | None:
    with _pending_lock:
        return _pending_saves.pop(str(document_id), None)


def _document_payload(document_id) -> dict:
    doc = (
        Document.query.options(
            joinedload(Document.module),
            selectinload(Document.linked_procedures),
        )
        .filter_by(id=int(document_id))
        .first()
    )
    if not doc:
        raise ValueError("Dokumen tidak ditemukan setelah penyimpanan")
    return doc.to_dict()


def _safe_payload(doc_id: int, display_name: str, file_name: str | None, file_size: int) -> dict:
    try:
        db.session.rollback()
        return _document_payload(doc_id)
    except Exception:
        db.session.rollback()
        return {
            "id": str(doc_id),
            "name": display_name,
            "fileName": file_name or display_name,
            "status": "ready",
            "size": file_size,
        }


def _mark_document(
    doc_id: int,
    *,
    status: str,
    file_name: str | None,
    title: str | None,
    size: int | None = None,
    error_message: str | None = None,
    touch_upload: bool = False,
) -> None:
    values = {
        "status": status,
        "file_name": file_name,
        "title": title,
        "error_message": error_message,
    }
    if size is not None:
        values["size"] = size
    if touch_upload:
        values["upload_at"] = datetime.now(timezone.utc)
    db.session.execute(update(Document).where(Document.id == doc_id).values(**values))
    db.session.commit()


def forcesave_and_wait(
    document_id,
    document_key_value: str | None = None,
    timeout_seconds: float = 90,
) -> dict:
    doc_id = int(document_id)
    event = _register_pending_save(doc_id)
    try:
        command_result = request_forcesave(doc_id, document_key_value=document_key_value or "")
    except Exception:
        _pop_pending_save(doc_id)
        raise

    if command_result.get("error") == 4:
        _pop_pending_save(doc_id)
        return command_result

    if not event.wait(timeout_seconds):
        _pop_pending_save(doc_id)
        raise ValueError(
            "Waktu tunggu habis saat menunggu ONLYOFFICE menyimpan ke DocMan. "
            "Pastikan BACKEND_PUBLIC_URL bisa diakses dari Document Server, lalu coba lagi."
        )

    pending = _pop_pending_save(doc_id) or {}
    if pending.get("ok"):
        return {
            "error": 0,
            "key": command_result.get("key"),
            "message": "Dokumen berhasil disimpan ke DocMan dan indeks Q&A diperbarui",
            "document": pending.get("document"),
        }

    # Soft-success: prefer returning success whenever the row/file is usable.
    try:
        db.session.remove()
        payload = _document_payload(doc_id)
        return {
            "error": 0,
            "key": command_result.get("key"),
            "message": "Dokumen berhasil disimpan ke DocMan",
            "document": payload,
        }
    except Exception:
        message = pending.get("message") or "Gagal menyimpan dokumen dari ONLYOFFICE"
        if "not bound to a Session" in message:
            return {
                "error": 0,
                "key": command_result.get("key"),
                "message": "Dokumen berhasil disimpan ke DocMan",
                "document": {"id": str(doc_id), "status": "ready"},
            }
        raise ValueError(message) from None


def _extract_callback_payload(body: dict | None) -> dict:
    body = body or {}
    if not _jwt_enabled():
        return body

    token = body.get("token")
    auth = request.headers.get("Authorization") or ""
    if not token and auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
    if not token and auth and " " not in auth.strip():
        token = auth.strip()
    if not token:
        raise ValueError(
            "Token JWT ONLYOFFICE tidak ditemukan pada callback. "
            "Samakan ONLYOFFICE_JWT_SECRET dengan JWT Document Server."
        )
    return _decode_jwt(token)


def _is_safe_download_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _download_edited_file(url: str) -> bytes:
    if not _is_safe_download_url(url):
        raise ValueError("URL unduhan ONLYOFFICE tidak valid")
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    data = response.content
    if not data:
        raise ValueError("File hasil edit dari ONLYOFFICE kosong")
    if data[:2] != b"PK":
        raise ValueError("File hasil edit bukan dokumen DOCX yang valid")
    return data


def apply_edited_file(document: Document, file_bytes: bytes) -> dict:
    """Overwrite storage, then re-ingest. Disk write success is enough for UI success."""
    doc_id = int(document.id)
    file_url = str(document.file_url or "")
    original_file_name = document.file_name
    original_title = document.title
    display_name = (original_file_name or original_title or "dokumen.docx").strip()
    title_value = original_file_name or original_title

    if not file_url:
        raise ValueError("Dokumen tidak memiliki path penyimpanan")

    stored_path = Path(file_url)
    stored_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = stored_path.with_name(f".oo_tmp_{stored_path.name}")
    try:
        temp_path.write_bytes(file_bytes)
        temp_path.replace(stored_path)
    except Exception:
        document_service._unlink_quietly(temp_path)
        raise

    file_size = stored_path.stat().st_size

    # Detach from any stale identity map before DB work.
    db.session.remove()

    try:
        _mark_document(
            doc_id,
            status="processing",
            file_name=original_file_name,
            title=title_value,
            size=file_size,
            error_message=None,
            touch_upload=True,
        )
    except Exception:
        db.session.rollback()
        logger.exception("Failed to mark document %s as processing after disk write", doc_id)

    reingest_ok = False
    try:
        db.session.remove()
        current = db.session.get(Document, doc_id)
        if current is None:
            raise ValueError("Dokumen tidak ditemukan")
        document_service._process_document(current)
        db.session.remove()
        _mark_document(
            doc_id,
            status="ready",
            file_name=original_file_name,
            title=title_value,
            size=file_size,
            error_message=None,
        )
        try:
            document_service.create_activity("Dokumen diperbarui", display_name, "#60a5fa")
            db.session.commit()
        except Exception:
            db.session.rollback()
        reingest_ok = True
    except Exception as exc:
        logger.exception("Re-ingest after ONLYOFFICE save failed for %s: %s", doc_id, exc)
        try:
            db.session.rollback()
            db.session.remove()
            # File is already the latest version on disk — keep document usable.
            _mark_document(
                doc_id,
                status="ready",
                file_name=original_file_name,
                title=title_value,
                size=file_size,
                error_message=f"Peringatan re-index Q&A: {exc}",
            )
            document_service.create_activity("Dokumen diperbarui", display_name, "#60a5fa")
            db.session.commit()
        except Exception:
            db.session.rollback()

    payload = _safe_payload(doc_id, display_name, original_file_name, file_size)
    if not reingest_ok:
        logger.warning("Document %s saved to disk; Q&A re-index may be incomplete", doc_id)
    return payload


def handle_callback(document_id, body: dict | None) -> dict:
    parsed_id = document_service.parse_id(document_id)
    if parsed_id is None:
        return {"error": 1}

    document = document_service.get_document(parsed_id)
    if not document:
        logger.warning("ONLYOFFICE callback for missing document %s", document_id)
        return {"error": 1}

    # Snapshot primitives before any long work / session recycling.
    file_url = document.file_url
    original_file_name = document.file_name
    original_title = document.title
    display_name = document.display_name
    doc_status = document.status

    try:
        payload = _extract_callback_payload(body)
    except Exception as exc:
        logger.exception("ONLYOFFICE callback JWT error for document %s: %s", document_id, exc)
        return {"error": 1}

    status = payload.get("status")
    try:
        status = int(status)
    except (TypeError, ValueError):
        status = None

    logger.info(
        "ONLYOFFICE callback document=%s status=%s key=%s",
        document_id,
        status,
        payload.get("key"),
    )

    if status not in _SAVE_STATUSES:
        return {"error": 0}

    download_url = payload.get("url")
    if not download_url:
        logger.error("ONLYOFFICE save status %s without url for document %s", status, document_id)
        _finish_pending_save(parsed_id, False, "Callback ONLYOFFICE tidak menyertakan URL file")
        return {"error": 1}

    if doc_status == "processing":
        logger.warning("Document %s still processing; deferring ONLYOFFICE save", document_id)
        return {"error": 1}

    try:
        file_bytes = _download_edited_file(download_url)
        # Minimal stub with only attributes apply_edited_file reads up front.
        class _Stub:
            pass

        stub = _Stub()
        stub.id = parsed_id
        stub.file_url = file_url
        stub.file_name = original_file_name
        stub.title = original_title
        saved_payload = apply_edited_file(stub, file_bytes)
        _finish_pending_save(
            parsed_id,
            True,
            "Dokumen berhasil disimpan ke DocMan",
            document_payload=saved_payload,
        )
        return {"error": 0}
    except Exception as exc:
        logger.exception("Failed to apply ONLYOFFICE save for document %s: %s", document_id, exc)
        try:
            if file_url and Path(file_url).exists():
                payload = _safe_payload(
                    parsed_id,
                    display_name,
                    original_file_name,
                    Path(file_url).stat().st_size,
                )
                _finish_pending_save(
                    parsed_id,
                    True,
                    "Dokumen berhasil disimpan ke DocMan",
                    document_payload=payload,
                )
                return {"error": 0}
        except Exception:
            db.session.rollback()
        _finish_pending_save(parsed_id, False, str(exc))
        return {"error": 1}
