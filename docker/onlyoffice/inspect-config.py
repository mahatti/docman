import json
from pathlib import Path

for name in ("local.json", "default.json"):
    path = Path(f"/etc/onlyoffice/documentserver/{name}")
    data = json.loads(path.read_text(encoding="utf-8"))
    co = data.get("services", {}).get("CoAuthoring", {})
    print(name, "rfa=", co.get("request-filtering-agent"))
    print(name, "token.enable=", co.get("token", {}).get("enable"))
