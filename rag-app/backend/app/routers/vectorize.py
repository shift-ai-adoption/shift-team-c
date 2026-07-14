from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import text
from app.models.schemas import VectorizeRequest
from app.services.vector_db import engine, update_status, save_chunks
from app.services.bedrock import embed

router = APIRouter()

def _chunk_text(text: str, size: int, overlap: int) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i:i+size]))
        i += size - overlap
    return chunks

def _vectorize(doc_id: str, chunk_size: int, overlap: int):
    try:
        update_status(doc_id, "processing")
        with engine.connect() as conn:
            row = conn.execute(text("SELECT raw_text FROM documents WHERE id=:id"), {"id": doc_id}).fetchone()
        if not row:
            return
        chunks = _chunk_text(row[0], chunk_size, overlap)
        emb_chunks = [(i, c, embed(c)) for i, c in enumerate(chunks)]
        save_chunks(doc_id, emb_chunks)
        update_status(doc_id, "vectorized", len(emb_chunks))
    except Exception as e:
        update_status(doc_id, "error", error=str(e))

@router.post("/vectorize/{doc_id}")
async def vectorize(doc_id: str, bg: BackgroundTasks, body: VectorizeRequest = None):
    body = body or VectorizeRequest()
    with engine.connect() as conn:
        row = conn.execute(text("SELECT status FROM documents WHERE id=:id"), {"id": doc_id}).fetchone()
    if not row:
        raise HTTPException(404, "Document not found")
    bg.add_task(_vectorize, doc_id, body.chunk_size, body.chunk_overlap)
    return {"status": "processing", "document_id": doc_id}
