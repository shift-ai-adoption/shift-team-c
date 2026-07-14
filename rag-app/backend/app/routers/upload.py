from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.extractor import extract_text
from app.services.vector_db import save_document

router = APIRouter()

ALLOWED_EXT = {".pdf", ".txt", ".md", ".csv", ".docx", ".xlsx"}

@router.post("/upload")
async def upload(file: UploadFile = File(...), version_label: str = ""):
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported file type: {ext}")
    data = await file.read()
    raw_text = extract_text(file.filename, data)
    if not raw_text.strip():
        raise HTTPException(422, "Could not extract text from file")
    label = version_label or file.filename
    doc_id = save_document(file.filename, label, file.content_type or "application/octet-stream", raw_text)
    return {"document_id": doc_id, "status": "uploaded", "filename": file.filename}
