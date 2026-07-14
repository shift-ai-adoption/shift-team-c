from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import upload, vectorize, search, compare, stats

app = FastAPI(title="RAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [upload.router, vectorize.router, search.router, compare.router, stats.router]:
    app.include_router(router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}
