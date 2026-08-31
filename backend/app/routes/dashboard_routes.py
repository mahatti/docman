from flask import Blueprint, jsonify

from app.service import document_service

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("")
def dashboard():
    return jsonify({"status": "success", "data": document_service.dashboard_summary()})
