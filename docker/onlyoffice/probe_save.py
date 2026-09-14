#!/usr/bin/env python3
"""Probe ONLYOFFICE callback + forcesave from host."""
import json
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app import create_app
from app.service import document_service, onlyoffice_service

BASE = "http://127.0.0.1:5000"


def main() -> None:
    app = create_app()
    with app.app_context():
        doc = document_service.get_document(33)
        assert doc is not None
        key = onlyoffice_service.document_key(doc)
        print("doc_id", doc.id)
        print("key", key)
        print("size", doc.size)
        print("upload_at", doc.upload_at)
        print("status", doc.status)
        print("jwt_enabled", onlyoffice_service._jwt_enabled())
        print("callback", onlyoffice_service._public_url(f"/api/documents/{doc.id}/onlyoffice/callback"))

    # Probe callback status=1 (no save)
    r = requests.post(
        f"{BASE}/api/documents/33/onlyoffice/callback",
        json={"status": 1, "key": "probe"},
        timeout=10,
    )
    print("callback_probe", r.status_code, r.text)

    # Forcesave without open session should return error 1
    r2 = requests.post(
        f"{BASE}/api/documents/33/onlyoffice/forcesave",
        json={"key": key},
        timeout=30,
    )
    print("forcesave", r2.status_code, r2.text)


if __name__ == "__main__":
    main()
