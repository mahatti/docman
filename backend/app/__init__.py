import atexit
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from app.config import Config

db = SQLAlchemy()


@event.listens_for(Engine, "connect")
def _register_pgvector(dbapi_connection, _connection_record):
    try:
        from pgvector.psycopg2 import register_vector

        register_vector(dbapi_connection)
    except Exception:
        pass


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    if not app.config.get("SQLALCHEMY_DATABASE_URI"):
        raise RuntimeError("DATABASE_URL belum di-set di backend/.env")

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    app.url_map.strict_slashes = False
    CORS(
        app,
        origins=list(
            dict.fromkeys(
                [
                    app.config["FRONTEND_ORIGIN"],
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                ]
            )
        ),
        supports_credentials=True,
        methods=["GET", "HEAD", "POST", "DELETE", "OPTIONS", "PROPFIND"],
        expose_headers=["DAV", "ETag", "Allow"],
        allow_headers="*",
    )

    @app.after_request
    def _office_dav_headers(response):
        path = request.path or ""
        if "/api/documents/" in path and ("/word/" in path or path.rstrip("/").endswith("/file")):
            response.headers.setdefault("DAV", "1")
        return response

    from app.routes.dashboard_routes import dashboard_bp
    from app.routes.document_routes import document_bp
    from app.routes.module_routes import module_bp
    from app.routes.procedure_routes import procedure_bp
    from app.routes.qna_routes import qna_bp

    app.register_blueprint(module_bp, url_prefix="/api/modules")
    app.register_blueprint(document_bp, url_prefix="/api/documents")
    app.register_blueprint(procedure_bp, url_prefix="/api/procedures")
    app.register_blueprint(qna_bp, url_prefix="/api/qna")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

    @app.get("/api/health")
    def health():
        return jsonify({
            "status": "success",
            "message": "DocMan API is running",
            "ooSaveFix": "v3-soft-success",
        })

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify({"status": "error", "message": "File terlalu besar (maks. 50 MB)"}), 413

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"status": "error", "message": "Endpoint tidak ditemukan"}), 404

    try:
        with app.app_context():
            from app.models import Activity, ChatMessage, Document, DocumentChunk, Module, Procedure  # noqa: F401
            from app.schema import ensure_pgvector_column, ensure_schema
            from app.service.document_service import default_module, repair_stored_page_numbers, repair_table_catalogs

            ensure_schema(db)
            db.create_all()
            ensure_pgvector_column(db)
            default_module()
            db.session.commit()
            try:
                repair_stored_page_numbers()
                repair_table_catalogs()
                db.session.commit()
            except Exception:
                db.session.rollback()
            finally:
                db.session.remove()
    except Exception as exc:
        if isinstance(exc, OperationalError):
            raise RuntimeError(
                "Gagal konek ke Supabase Postgres. Pastikan project Active (bukan Paused), "
                "DATABASE_URL memakai Session pooler (user postgres.<project-ref>, host "
                "pooler.supabase.com:5432) tanpa kurung siku di password, lalu restart backend."
            ) from exc
        raise

    def _dispose_engine():
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
        except Exception:
            pass

    atexit.register(_dispose_engine)
    return app
