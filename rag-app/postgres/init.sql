-- pgvector 拡張の有効化と初期スキーマ
CREATE EXTENSION IF NOT EXISTS vector;

-- ドキュメント（アップロード単位）
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    filename TEXT NOT NULL,
    version_label TEXT NOT NULL,          -- バージョン識別ラベル（省略時はファイル名）
    content_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded | processing | vectorized | error
    chunk_pattern TEXT,                    -- ベクトル化時に選択されたチャンクパターン
    chunk_count INTEGER DEFAULT 0,
    error_message TEXT,
    raw_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    vectorized_at TIMESTAMPTZ
);

-- チャンク（ベクトル化単位） Titan Embed v2 = 1024次元
CREATE TABLE IF NOT EXISTS chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1024)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
-- コサイン類似度検索用 IVFFlat インデックス（データ量が増えたら有効）
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
