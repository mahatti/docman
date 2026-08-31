from app import db

document_procedures = db.Table(
    "document_procedures",
    db.Column(
        "document_id",
        db.BigInteger,
        db.ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column(
        "procedure_id",
        db.BigInteger,
        db.ForeignKey("procedures.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Procedure(db.Model):
    __tablename__ = "procedures"

    id = db.Column(db.BigInteger, primary_key=True)
    name = db.Column(db.String, nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)

    documents = db.relationship(
        "Document",
        secondary=document_procedures,
        back_populates="linked_procedures",
        lazy="dynamic",
    )

    def to_dict(self, include_documents: bool = False):
        payload = {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "documentCount": self.documents.count(),
        }
        if include_documents:
            from app.models.document_model import Document

            payload["documents"] = [
                {
                    "id": str(doc.id),
                    "name": doc.title,
                    "documentCode": doc.document_code,
                    "version": doc.version,
                }
                for doc in self.documents.order_by(Document.upload_at.desc())
            ]
        return payload
