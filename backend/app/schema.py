from sqlalchemy import text

SCHEMA_STATEMENTS = [
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS size INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS type VARCHAR(20)",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS pages INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS procedures INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'processing'",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_code VARCHAR",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS version VARCHAR(32)",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS table_catalog JSONB",
    """
    CREATE TABLE IF NOT EXISTS procedures (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR NOT NULL UNIQUE,
        description TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS document_procedures (
        document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        procedure_id BIGINT NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
        PRIMARY KEY (document_id, procedure_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_documents_document_code ON documents (document_code)",
    "CREATE INDEX IF NOT EXISTS ix_documents_version ON documents (version)",
    "CREATE INDEX IF NOT EXISTS ix_document_procedures_procedure_id ON document_procedures (procedure_id)",
]


def ensure_schema(db):
    db.session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    db.session.commit()
    for statement in SCHEMA_STATEMENTS:
        db.session.execute(text(statement))
    db.session.commit()


def ensure_pgvector_column(db):
    db.session.execute(
        text("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536)")
    )
    db.session.commit()
    try:
        db.session.execute(
            text(
                "CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw "
                "ON document_chunks USING hnsw (embedding vector_cosine_ops)"
            )
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
