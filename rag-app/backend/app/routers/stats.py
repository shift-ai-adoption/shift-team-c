from fastapi import APIRouter
from app.services.redis_svc import top_keywords
from app.services.vector_db import list_documents

router = APIRouter()

@router.get("/stats/keywords")
async def keywords(top: int = 10):
    return top_keywords(top)

@router.get("/documents")
async def documents():
    return list_documents()
