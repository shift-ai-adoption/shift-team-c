from fastapi import APIRouter
from app.models.schemas import SearchRequest, SearchResponse, ChunkResult
from app.services.bedrock import embed, generate
from app.services.vector_db import search_chunks
from app.services.redis_svc import record_keyword

router = APIRouter()

SYSTEM_PROMPT = (
    "あなたは社内文書検索アシスタントです。"
    "提供された文書チャンクのみを根拠として回答してください。"
    "根拠がない場合は「提供された文書には該当情報がありません」と答えてください。"
)

@router.post("/search", response_model=SearchResponse)
async def search(body: SearchRequest):
    q_emb = embed(body.query)
    hits  = search_chunks(q_emb, body.document_ids, body.top_k)
    record_keyword(body.query)
    context = "\n\n".join(f"[{h['filename']} chunk {h['chunk_index']}]\n{h['content']}" for h in hits)
    user_msg = f"質問: {body.query}\n\n参考文書:\n{context}"
    answer   = generate(SYSTEM_PROMPT, user_msg)
    return SearchResponse(
        answer=answer,
        chunks=[ChunkResult(**h) for h in hits]
    )
