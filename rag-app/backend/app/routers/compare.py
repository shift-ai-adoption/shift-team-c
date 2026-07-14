from fastapi import APIRouter
from concurrent.futures import ThreadPoolExecutor
from app.models.schemas import CompareRequest
from app.services.bedrock import embed, generate
from app.services.vector_db import search_chunks
from app.services.redis_svc import record_keyword

router = APIRouter()

SYSTEM_PROMPT = (
    "あなたは社内文書検索アシスタントです。"
    "提供された文書チャンクのみを根拠として回答してください。"
)

def _answer_for(version_id: str, query: str, q_emb: list):
    hits = search_chunks(q_emb, [version_id], top_k=5)
    context = "\n\n".join(f"[chunk {h['chunk_index']}]\n{h['content']}" for h in hits)
    answer  = generate(SYSTEM_PROMPT, f"質問: {query}\n\n参考文書:\n{context}")
    return {"document_id": version_id, "answer": answer, "chunks": hits}

@router.post("/compare")
async def compare(body: CompareRequest):
    q_emb = embed(body.query)
    record_keyword(body.query)
    with ThreadPoolExecutor() as ex:
        futures = [ex.submit(_answer_for, vid, body.query, q_emb) for vid in body.version_ids]
        results = [f.result() for f in futures]
    return {"query": body.query, "results": results}
