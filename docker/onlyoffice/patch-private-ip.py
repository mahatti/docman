#!/usr/bin/env python3
"""Patch ONLYOFFICE config for local Docker + host backend."""

import json
from pathlib import Path


def patch(path: Path) -> None:
    cfg = {}
    if path.exists():
        try:
            cfg = json.loads(path.read_text(encoding="utf-8") or "{}")
        except Exception:
            cfg = {}

    co = cfg.setdefault("services", {}).setdefault("CoAuthoring", {})
    co["request-filtering-agent"] = {
        "allowPrivateIPAddress": True,
        "allowMetaIPAddress": True,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    print(f"patched {path}")


for name in ("local.json", "default.json"):
    patch(Path(f"/etc/onlyoffice/documentserver/{name}"))
