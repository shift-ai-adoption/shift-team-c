import os, uuid
from sqlalchemy import create_engine, text
from pgvector.sqlalchemy import Vector  # noqa: F401 – registers type

DB_URL = os.getenv("DATABASE_URL", "postgresql://raguser:ragpass@postgres:5432/ragdb")
engine = create_engine(DB_URL, pool_pre_ping=True, pool_size=5)

def save_document(filename: str, version_label: str, content_type: str, raw_text: str) -> str:
    doc_id = str(uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO documents(id, filename, version_label, content_type, raw_text) "
            "VALUES (:id,:fn,:vl,:ct,:rt)"
        ), {"id": doc_id, "fn": filename, "vl": version_label, "ct": content_type, "rt": raw_text})
    return doc_id

def update_status(doc_id: str, status: str, chunk_count: int = 0, error: str = None):
    with engine.begin() as conn:
        conn.execute(text(
            "UPDATE documents SET status=:s, chunk_count=:c, error_message=:e, "
            "vectorized_at=CASE WHEN :s='vectorized' THEN now() ELSE NULL END WHERE id=:id"
        ), {"s": status, "c": chunk_count, "e": error, "id": doc_id})

def save_chunks(doc_id: str, chunks: list[tuple[int, str, list[float]]]):
    with engine.begin() as conn:
        for idx, content, emb in chunks:
            conn.execute(text(
                "INSERT INTO chunks(document_id, chunk_index, content, embedding) VALUES(:did,:ci,:ct,:em)"
            ), {"did": doc_id, "ci": idx, "ct": content, "em": str(emb)})

def list_documents() -> list[dict]:
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id,filename,version_label,status,chunk_count,created_at FROM documents ORDER BY created_at DESC"
        )).fetchall()
    return [{"id": str(r[0]), "filename": r[1], "version_label": r[2],
             "status": r[3], "chunk_count": r[4], "created_at": str(r[5])} for r in rows]

def search_chunks(query_emb: list[float], document_ids: list[str] | None, top_k: int) -> list[dict]:
    vec_str = str(query_emb)
    with engine.connect() as conn:
        if document_ids:
            ids_tuple = tuple(document_ids)
            rows = conn.execute(text(
                "SELECT c.document_id, d.filename, c.chunk_index, c.content, "
                "1 - (c.embedding <=> :emb) AS score "
                "FROM chunks c JOIN documents d ON d.id=c.document_id "
                "WHERE c.document_id = ANY(:ids) "
                "ORDER BY c.embedding <=> :emb LIMIT :k"
            ), {"emb": vec_str, "ids": list(document_ids), "k": top_k}).fetchall()
        else:
            rows = conn.execute(text(
                "SELECT c.document_id, d.filename, c.chunk_index, c.content, "
                "1 - (c.embedding <=> :emb) AS score "
                "FROM chunks c JOIN documents d ON d.id=c.document_id "
                "ORDER BY c.embedding <=> :emb LIMIT :k"
            ), {"emb": vec_str, "k": top_k}).fetchall()
    return [{"document_id": str(r[0]), "filename": r[1], "chunk_index": r[2],
             "content": r[3], "score": float(r[4])} for r in rows]
