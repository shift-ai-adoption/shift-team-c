from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

class DocumentOut(BaseModel):
    id: str
    filename: str
    version_label: str
    status: str
    chunk_count: int
    created_at: str

class VectorizeRequest(BaseModel):
    # chunk_size: 日本語テキストはトークン数が多いため、デフォルトを小さく設定。
    # EMBED_MAX_CHARS=4000 に合わせて 300 ワードを上限とする。
    chunk_size: int = 300
    chunk_overlap: int = 30

class SearchRequest(BaseModel):
    query: str
    document_ids: Optional[List[str]] = None
    top_k: int = 5

class ChunkResult(BaseModel):
    document_id: str
    filename: str
    chunk_index: int
    content: str
    score: float

class SearchResponse(BaseModel):
    answer: str
    chunks: List[ChunkResult]

class CompareRequest(BaseModel):
    query: str
    version_ids: List[str]

class KeywordRank(BaseModel):
    keyword: str
    count: int
