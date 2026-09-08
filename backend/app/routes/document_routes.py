from pathlib import Path

from flask import Blueprint, jsonify, request, send_file

from app.service import document_service
from app.service.word_dav import handle_word_dav

document_bp = Blueprint("documents", __name__)


@document_bp.get("")
def list_documents():
    docs = document_service.list_documents(
        module_id=request.args.get("moduleId") or request.args.get("module_id"),
        procedure=request.args.get("procedure") or request.args.get("procedureName"),
        title=request.args.get("title"),
        document_code=request.args.get("documentCode") or request.args.get("document_code"),
        version=request.args.get("version"),
        q=request.args.get("q") or request.args.get("search"),
    )
    return jsonify({"status": "success", "data": [doc.to_dict() for doc in docs]})


@document_bp.get("/filters")
def list_document_filters():
    return jsonify({"status": "success", "data": document_service.list_document_filters()})


@document_bp.get("/<document_id>")
def get_document(document_id):
    document = document_service.get_document(document_id)
    if not document:
        return jsonify({"status": "error", "message": "Dokumen tidak ditemukan"}), 404
    return jsonify({"status": "success", "data": document.to_dict()})


@document_bp.get("/<document_id>/preview")
def preview_document(document_id):
    payload = document_service.preview_document(document_id)
    if not payload:
        return jsonify({"status": "error", "message": "Dokumen tidak ditemukan"}), 404
    return jsonify({"status": "success", "data": payload})


@document_bp.post("")
def upload_document():
    files = request.files.getlist("files") or request.files.getlist("file")
    if not files:
        uploaded = request.files.get("file")
        files = [uploaded] if uploaded else []
    files = [item for item in files if item and item.filename]
    if not files:
        return jsonify({"status": "error", "message": "Tidak ada file yang diunggah"}), 400

    module_id = request.form.get("moduleId") or request.form.get("module_id")
    try:
        documents = [document_service.save_upload(item, module_id=module_id) for item in files]
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400
    except Exception as exc:
        return jsonify({"status": "error", "message": f"Gagal mengunggah dokumen: {exc}"}), 500

    payload = [doc.to_dict() for doc in documents]
    return jsonify({"status": "success", "data": payload if len(payload) > 1 else payload[0]}), 201


@document_bp.route(
    "/<document_id>/word/<path:filename>",
    methods=["OPTIONS", "GET", "HEAD", "PUT", "LOCK", "UNLOCK", "PROPFIND", "PROPPATCH"],
    provide_automatic_options=False,
)
def word_document(document_id, filename):
    return handle_word_dav(document_id, filename)


@document_bp.route(
    "/<document_id>/file",
    methods=["OPTIONS", "GET", "HEAD", "PUT", "LOCK", "UNLOCK", "PROPFIND", "PROPPATCH"],
    provide_automatic_options=False,
)
def word_document_alias(document_id):
    return handle_word_dav(document_id, None)


@document_bp.get("/<document_id>/download")
def download_document(document_id):
    document = document_service.get_document(document_id)
    if not document or not document.file_url:
        return jsonify({"status": "error", "message": "Dokumen tidak ditemukan"}), 404

    path = Path(document.file_url)
    if not path.exists():
        return jsonify({"status": "error", "message": "File fisik tidak ditemukan"}), 404
    return send_file(path, as_attachment=True, download_name=document.display_name)


@document_bp.delete("/<document_id>")
def delete_document(document_id):
    try:
        deleted = document_service.delete_document(document_id)
    except Exception as exc:
        return jsonify({"status": "error", "message": f"Gagal menghapus dokumen: {exc}"}), 500
    if not deleted:
        return jsonify({"status": "error", "message": "Dokumen tidak ditemukan"}), 404
    return jsonify({"status": "success", "data": None, "message": "Dokumen dihapus"})
