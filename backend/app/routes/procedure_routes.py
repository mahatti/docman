from flask import Blueprint, jsonify

from app.service import procedure_service

procedure_bp = Blueprint("procedures", __name__)


@procedure_bp.get("")
def list_procedures():
    procedures = procedure_service.list_procedures()
    return jsonify({"status": "success", "data": [item.to_dict() for item in procedures]})


@procedure_bp.get("/<procedure_id>")
def get_procedure(procedure_id):
    procedure = procedure_service.get_procedure(procedure_id)
    if not procedure:
        return jsonify({"status": "error", "message": "Prosedur tidak ditemukan"}), 404
    return jsonify({"status": "success", "data": procedure.to_dict(include_documents=True)})
