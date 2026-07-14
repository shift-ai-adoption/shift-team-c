import os, redis as _redis
from functools import lru_cache

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

@lru_cache(maxsize=1)
def _r():
    return _redis.from_url(REDIS_URL, decode_responses=True)

KEYWORD_KEY = "rag:keyword_rank"

def record_keyword(query: str):
    try:
        _r().zincrby(KEYWORD_KEY, 1, query)
    except Exception:
        pass

def top_keywords(n: int = 10) -> list[dict]:
    try:
        items = _r().zrevrangebyscore(KEYWORD_KEY, "+inf", "-inf", start=0, num=n, withscores=True)
        return [{"keyword": k, "count": int(s)} for k, s in items]
    except Exception:
        return []
