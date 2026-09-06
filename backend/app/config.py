import os
import re
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


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

    if uri and "sslmode=" not in uri:
        uri += ("&" if "?" in uri else "?") + "sslmode=require"
    return uri


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "docman-dev-secret")
    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }

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
    ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "txt"}
