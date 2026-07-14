import boto3, json, os
from functools import lru_cache

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
LLM_MODEL       = os.getenv("LLM_MODEL_ID",       "us.anthropic.claude-sonnet-4-5-20250929-v1:0")

# Titan Embed Text v2 の最大トークン数は 8,192。
# 日本語テキストでは1文字あたりのトークン数が多いため、
# 文字数ベースの上限を 4,000 文字に抑えて安全マージンを確保する。
# （英語テキストでも 1 トークン ≈ 4 文字なので 8,000文字 ≈ 2,000 トークンに収まる）
EMBED_MAX_CHARS = int(os.getenv("EMBED_MAX_CHARS", "4000"))

@lru_cache(maxsize=1)
def _client():
    return boto3.client("bedrock-runtime", region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"))

def embed(text: str) -> list[float]:
    resp = _client().invoke_model(
        modelId=EMBEDDING_MODEL,
        body=json.dumps({"inputText": text[:EMBED_MAX_CHARS]})
    )
    return json.loads(resp["body"].read())["embedding"]

def generate(system: str, user: str) -> str:
    resp = _client().converse(
        modelId=LLM_MODEL,
        system=[{"text": system}],
        messages=[{"role": "user", "content": [{"text": user}]}],
        inferenceConfig={"maxTokens": 2048, "temperature": 0.0}
    )
    return resp["output"]["message"]["content"][0]["text"]
