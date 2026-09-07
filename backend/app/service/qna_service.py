from app import db
from app.models import ChatMessage
from app.service.document_service import create_activity, parse_id
from app.service.rag_service import answer_question


def list_messages(limit: int = 50):
    return ChatMessage.query.order_by(ChatMessage.timestamp.asc()).limit(limit).all()


def clear_messages() -> int:
    deleted = ChatMessage.query.delete(synchronize_session=False)
    db.session.commit()
    return deleted


def ask_question(question: str, document_id=None) -> ChatMessage:
    question = (question or "").strip()
    if not question:
        raise ValueError("Pertanyaan tidak boleh kosong.")

    parsed_document_id = parse_id(document_id)
    user_msg = ChatMessage(role="user", content=question, document_id=parsed_document_id)
    db.session.add(user_msg)
    db.session.flush()

    answer, sources = answer_question(question, parsed_document_id)

    assistant_msg = ChatMessage(
        role="assistant",
        content=answer,
        sources=sources,
        document_id=parsed_document_id,
    )
    db.session.add(assistant_msg)
    create_activity("Pertanyaan dijawab", question[:80], "#60a5fa")
    db.session.commit()
    return assistant_msg
