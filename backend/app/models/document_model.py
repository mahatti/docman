from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector

from app import db
from app.models.procedure_model import Procedure, document_procedures


def _utcnow():
    return datetime.now(timezone.utc)


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.BigInteger, primary_key=True)
    title = db.Column(db.String, nullable=False)
    description = db.Column(db.String, nullable=True)
    module_id = db.Column(db.BigInteger, db.ForeignKey("modules.id"), nullable=True)
    document_code = db.Column(db.String, nullable=True, index=True)
    version = db.Column(db.String(32), nullable=True, index=True)
    file_name = db.Column(db.String, nullable=True)
    file_url = db.Column(db.String, nullable=True)
    upload_at = db.Column(db.DateTime, default=_utcnow, nullable=True)
    size = db.Column(db.Integer, nullable=False, default=0)
    type = db.Column(db.String(20), nullable=True)
    pages = db.Column(db.Integer, nullable=False, default=0)
    procedure_count = db.Column("procedures", db.Integer, nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default="processing")
    tags = db.Column(db.JSON, nullable=False, default=list)
    error_message = db.Column(db.Text, nullable=True)

    chunks = db.relationship(
        "DocumentChunk",
        backref="document",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    linked_procedures = db.relationship(
        "Procedure",
        secondary=document_procedures,
        back_populates="documents",
        lazy="selectin",
        order_by=Procedure.name,
    )

    def to_dict(self):
        uploaded = self.upload_at
        if uploaded and uploaded.tzinfo is None:
            uploaded = uploaded.replace(tzinfo=timezone.utc)
        procedure_names = [item.name for item in self.linked_procedures]
        return {
            "id": str(self.id),
            "name": self.title,
            "size": self.size or 0,
            "type": self.type or "",
            "uploadedAt": uploaded.isoformat() if uploaded else None,
            "pages": self.pages or 0,
            "procedures": len(procedure_names) or self.procedure_count or 0,
            "procedureNames": procedure_names,
            "status": self.status or "processing",
            "tags": self.tags or [],
            "moduleId": str(self.module_id) if self.module_id else None,
            "moduleName": self.module.name if self.module else None,
            "documentCode": self.document_code,
            "version": self.version,
            "fileName": self.file_name,
            "description": self.description,
        }


class DocumentChunk(db.Model):
    __tablename__ = "document_chunks"

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(
        db.BigInteger,
        db.ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page = db.Column(db.Integer, nullable=False, default=1)
    chunk_index = db.Column(db.Integer, nullable=False, default=0)
    content = db.Column(db.Text, nullable=False)
    embedding = db.Column(Vector(1536), nullable=True)

    def to_source(self, doc_name: str, excerpt_len: int = 160):
        excerpt = (self.content or "").strip().replace("\n", " ")
        if len(excerpt) > excerpt_len:
            excerpt = excerpt[:excerpt_len].rstrip() + "..."
        return {
            "docName": doc_name,
            "page": self.page,
            "excerpt": excerpt,
        }
