from flask import Blueprint, jsonify, request

from app.service import module_service

module_bp = Blueprint("modules", __name__)


@module_bp.get("")
def list_modules():
    modules = module_service.list_modules()
    return jsonify({"status": "success", "data": [module.to_dict() for module in modules]})


@module_bp.get("/<module_id>")
def get_module(module_id):
    module = module_service.get_module(module_id)
    if not module:
        return jsonify({"status": "error", "message": "Modul tidak ditemukan"}), 404
    return jsonify({"status": "success", "data": module.to_dict()})


@module_bp.post("")
def create_module():
    payload = request.get_json(silent=True) or {}
    try:
        module = module_service.create_module(payload.get("name", ""))
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400
    return jsonify({"status": "success", "data": module.to_dict()}), 201


@module_bp.delete("/<module_id>")
def delete_module(module_id):
    deleted = module_service.delete_module(module_id)
    if not deleted:
        return jsonify({"status": "error", "message": "Modul tidak ditemukan"}), 404
    return jsonify({"status": "success", "message": "Modul dihapus"})
