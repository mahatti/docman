from datetime import datetime, timezone

from app import db


def _utcnow():
    return datetime.now(timezone.utc)


class Activity(db.Model):
    __tablename__ = "activities"

    id = db.Column(db.Integer, primary_key=True)
    event = db.Column(db.String(120), nullable=False)
    detail = db.Column(db.String(255), nullable=False, default="")
    color = db.Column(db.String(20), nullable=False, default="#60a5fa")
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)

    def to_dict(self):
        created = self.created_at
        if created and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return {
            "id": self.id,
            "event": self.event,
            "detail": self.detail,
            "color": self.color,
            "createdAt": created.isoformat() if created else None,
        }
