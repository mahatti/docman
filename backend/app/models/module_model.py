from app import db


class Module(db.Model):
    __tablename__ = "modules"

    id = db.Column(db.BigInteger, primary_key=True)
    name = db.Column(db.String, nullable=False, unique=True)

    documents = db.relationship("Document", backref="module", lazy="dynamic")

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "documentCount": self.documents.count(),
        }
