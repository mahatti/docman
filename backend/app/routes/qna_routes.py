from flask import Blueprint, jsonify, request

from app.service import qna_service

qna_bp = Blueprint("qna", __name__)


@qna_bp.get("/messages")
def list_messages():
    messages = qna_service.list_messages()
    return jsonify({"status": "success", "data": [msg.to_dict() for msg in messages]})


@qna_bp.post("/ask")
def ask():
    payload = request.get_json(silent=True) or {}
    question = payload.get("question") or payload.get("content") or ""
    document_id = payload.get("documentId") or payload.get("document_id")
    if document_id in ("", "all"):
        document_id = None

    try:
        message = qna_service.ask_question(question, document_id)
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400
    except Exception as exc:
        return jsonify({"status": "error", "message": f"Gagal menghasilkan jawaban: {exc}"}), 500

    return jsonify({"status": "success", "data": message.to_dict()})
