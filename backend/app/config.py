import os
import re
import time
from pathlib import Path
from urllib.parse import quote_plus, unquote, urlparse

from dotenv import load_dotenv
from sqlalchemy.pool import NullPool

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")
# Domain-joined Windows sends a GSSENCRequest; Supavisor drops that socket.
os.environ["PGGSSENCMODE"] = "disable"


def _append_query(uri: str, key: str, value: str) -> str:
    if not uri or f"{key}=" in uri:
        return uri
    return uri + ("&" if "?" in uri else "?") + f"{key}={value}"


def _connect_kwargs(uri: str) -> dict:
    parsed = urlparse(uri)
    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "user": unquote(parsed.username or ""),
        "password": unquote(parsed.password or ""),
        "dbname": (parsed.path or "/postgres").lstrip("/") or "postgres",
        "sslmode": "require",
        "gssencmode": "disable",
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }


def _pooler_ports(host: str | None, port: int) -> list[int]:
    if "pooler.supabase.com" not in (host or ""):
        return [port]
    ports: list[int] = []
    for candidate in (port, 6543, 5432):
        if candidate not in ports:
            ports.append(candidate)
    return ports


def _create_connection():
    """Retry pooler connects and fall back across 6543/5432."""
    import psycopg2

    kwargs = _connect_kwargs(_database_uri())
    last_error = None
    for attempt in range(3):
        for port in _pooler_ports(kwargs["host"], kwargs["port"]):
            try:
                return psycopg2.connect(**{**kwargs, "port": port})
            except psycopg2.OperationalError as exc:
                last_error = exc
        if attempt < 2:
            time.sleep(0.7 * (attempt + 1))
    raise last_error


def _engine_options() -> dict:
    uri = os.getenv("DATABASE_URL", "")
    # Supabase session-mode pooler caps clients at pool_size (often 15).
    # A local QueuePool on top of that — plus Flask reloader processes —
    # exhausts the cap. Let the pooler own pooling and close connections
    # after each checkout.
    if "pooler.supabase.com" in uri:
        return {
            "poolclass": NullPool,
            "pool_pre_ping": True,
            "creator": _create_connection,
        }
    return {
        "pool_size": 5,
        "max_overflow": 2,
        "pool_pre_ping": True,
        "pool_recycle": 280,
        "pool_use_lifo": True,
        "connect_args": {
            "connect_timeout": 10,
            "sslmode": "require",
            "gssencmode": "disable",
        },
        "creator": _create_connection,
    }


def _database_uri() -> str:
    uri = os.getenv("DATABASE_URL", "").strip()
    if uri.startswith("postgres://"):
        uri = uri.replace("postgres://", "postgresql://", 1)

    match = re.match(r"(postgresql(?:\+\w+)?://)([^:]+):(.+)@([^/?]+)(.*)$", uri)
    if match:
        scheme, user, password, host, rest = match.groups()
        if password.startswith("[") and password.endswith("]"):
            password = password[1:-1]
        uri = f"{scheme}{user}:{quote_plus(password)}@{host}{rest}"

    # Session pooler :5432 is the URI that fails with "server closed unexpectedly"
    # on some Windows/corp networks. SQLAlchemy should use transaction mode.
    if "pooler.supabase.com" in uri:
        uri = re.sub(r":5432(?=/|\?|$)", ":6543", uri, count=1)

    uri = _append_query(uri, "sslmode", "require")
    uri = _append_query(uri, "gssencmode", "disable")
    return uri


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "docman-dev-secret")
    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = _engine_options()

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))
    CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
    CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))
    RETRIEVE_K = int(os.getenv("RETRIEVE_K", "6"))

    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads"))
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024
    ALLOWED_EXTENSIONS = {"docx"}

    # ONLYOFFICE Document Server — Document Server must be able to reach BACKEND_PUBLIC_URL
    ONLYOFFICE_URL = os.getenv("ONLYOFFICE_URL", "http://localhost:8080").rstrip("/")
    ONLYOFFICE_JWT_SECRET = os.getenv("ONLYOFFICE_JWT_SECRET", "").strip()
    BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", "http://127.0.0.1:5000").rstrip("/")
