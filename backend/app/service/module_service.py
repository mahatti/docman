from app import db
from app.models.module_model import Module
from app.service.document_service import parse_id


def list_modules():
    return Module.query.order_by(Module.id.asc()).all()


def get_module(module_id):
    parsed = parse_id(module_id)
    if parsed is None:
        return None
    return db.session.get(Module, parsed)


def create_module(name: str) -> Module:
    name = (name or "").strip()
    if not name:
        raise ValueError("Nama modul tidak boleh kosong.")
    existing = Module.query.filter(Module.name.ilike(name)).first()
    if existing:
        raise ValueError(f"Modul {existing.name} sudah ada.")
    module = Module(name=name)
    db.session.add(module)
    db.session.commit()
    return module


def delete_module(module_id) -> bool:
    module = get_module(module_id)
    if not module:
        return False
    db.session.delete(module)
    db.session.commit()
    return True
