from datetime import datetime, timezone

from app import db


def _utcnow():
    return datetime.now(timezone.utc)


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    sources = db.Column(db.JSON, nullable=True)
    document_id = db.Column(db.BigInteger, nullable=True)
    timestamp = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)

    def to_dict(self):
        ts = self.timestamp
        if ts and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "sources": self.sources or [],
            "timestamp": ts.isoformat() if ts else None,
        }
