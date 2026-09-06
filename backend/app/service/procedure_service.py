from app import db
from app.models import Procedure
from app.service.document_service import parse_id


def list_procedures():
    return Procedure.query.order_by(Procedure.name.asc()).all()


def get_procedure(procedure_id):
    parsed = parse_id(procedure_id)
    if parsed is None:
        return None
    return db.session.get(Procedure, parsed)
