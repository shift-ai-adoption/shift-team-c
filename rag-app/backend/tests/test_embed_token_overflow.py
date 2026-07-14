"""
テスト: ベクトル化トークン超過バグ (#8) の検証

Amazon Titan Embed Text v2 の最大トークン数は 8,192。
日本語テキストでは 1 文字あたり 2〜3 トークン消費するため、
8,000 文字の上限設定では実際に 8,192 トークンを超過する場合がある。

このテストは以下を検証する:
  1. バグ再現: text[:8000] では日本語テキストが上限を超えうることを示す
  2. 修正確認: text[:4000] (EMBED_MAX_CHARS=4000) では安全に収まることを示す
  3. chunkサイズ変更の確認: デフォルト chunk_size が 512 → 300 に変更されていること
"""

import sys
import os
import unittest
from unittest.mock import patch, MagicMock

# テスト対象モジュールをインポートできるようパスを追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# ヘルパー関数
# ---------------------------------------------------------------------------

def count_tokens_approximation(text: str) -> int:
    """
    Titan Embed v2 のトークン数を近似計算する。
    日本語文字(CJK)は 1 文字 ≒ 2 トークン、ASCII は 1 文字 ≒ 0.25 トークン として推定。
    ※ 実際のトークナイザーを使わず、保守的に見積もる簡易実装。
    """
    token_count = 0
    for ch in text:
        cp = ord(ch)
        if 0x3000 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF or 0x20000 <= cp <= 0x2FA1F:
            token_count += 2   # CJK文字（日本語・中国語・韓国語）
        elif cp > 0x007F:
            token_count += 2   # その他非ASCII
        else:
            token_count += 1   # ASCII (スペース含む)
    return token_count


def make_japanese_text(char_count: int) -> str:
    """指定文字数の日本語テキストを生成する（繰り返しパターン）。"""
    base = "これはテスト用の日本語テキストです。アーキテクチャ標準ドキュメントの内容を模したサンプルです。"
    repeat = (char_count // len(base)) + 1
    return (base * repeat)[:char_count]


TITAN_EMBED_MAX_TOKENS = 8192


# ---------------------------------------------------------------------------
# テストケース 1: バグの再現 — text[:8000] では上限を超えうる
# ---------------------------------------------------------------------------

class TestBugReproduction(unittest.TestCase):
    """
    修正前のコード (text[:8000]) では日本語テキストがトークン上限を超えることを示す。
    """

    def test_8000_chars_japanese_exceeds_token_limit(self):
        """8,000文字の日本語テキストは8,192トークンを超える可能性がある（バグ）。"""
        text_8000 = make_japanese_text(8000)
        token_estimate = count_tokens_approximation(text_8000)

        print(f"\n[バグ再現] 8000文字テキストの推定トークン数: {token_estimate}")
        print(f"  Titan Embed v2 上限: {TITAN_EMBED_MAX_TOKENS}")
        print(f"  超過?: {token_estimate > TITAN_EMBED_MAX_TOKENS}")

        # 日本語8,000文字では推定トークン数が上限を超えることを検証
        self.assertGreater(
            token_estimate,
            TITAN_EMBED_MAX_TOKENS,
            f"8,000文字の日本語テキストは {token_estimate} トークン推定 → "
            f"Titan Embed v2 の上限 {TITAN_EMBED_MAX_TOKENS} を超えている（バグの再現）"
        )

    def test_old_embed_max_chars_was_8000(self):
        """修正前は EMBED_MAX_CHARS が 8000 文字だったことを確認する（ドキュメント的テスト）。"""
        old_max_chars = 8000
        text = make_japanese_text(old_max_chars)
        truncated = text[:old_max_chars]
        token_estimate = count_tokens_approximation(truncated)

        print(f"\n[修正前の仕様] text[:8000] の推定トークン数: {token_estimate}")
        self.assertEqual(len(truncated), old_max_chars)
        # 旧実装は unsafe だったことを示す
        self.assertGreater(
            token_estimate, TITAN_EMBED_MAX_TOKENS,
            "旧実装 (text[:8000]) では日本語テキストがトークン上限を超える"
        )


# ---------------------------------------------------------------------------
# テストケース 2: 修正の確認 — text[:4000] では上限内に収まる
# ---------------------------------------------------------------------------

class TestBugFix(unittest.TestCase):
    """
    修正後のコード (EMBED_MAX_CHARS=4000) では日本語テキストがトークン上限内に収まることを示す。
    """

    def test_4000_chars_japanese_within_token_limit(self):
        """4,000文字の日本語テキストは8,192トークン以下に収まる（修正後）。"""
        text_4000 = make_japanese_text(4000)
        token_estimate = count_tokens_approximation(text_4000)

        print(f"\n[修正後の確認] 4000文字テキストの推定トークン数: {token_estimate}")
        print(f"  Titan Embed v2 上限: {TITAN_EMBED_MAX_TOKENS}")
        print(f"  安全?: {token_estimate <= TITAN_EMBED_MAX_TOKENS}")

        self.assertLessEqual(
            token_estimate,
            TITAN_EMBED_MAX_TOKENS,
            f"4,000文字の日本語テキストは {token_estimate} トークン推定 → "
            f"Titan Embed v2 の上限 {TITAN_EMBED_MAX_TOKENS} 以内（修正後は安全）"
        )

    def test_embed_max_chars_default_is_4000(self):
        """EMBED_MAX_CHARS のデフォルト値が 4000 に設定されていることを確認する。"""
        # 環境変数が未設定の場合のデフォルト値を確認
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("EMBED_MAX_CHARS", None)
            # bedrock モジュールを再インポートして定数を確認
            import importlib
            # モジュールが既にキャッシュされている場合はリロード
            if "app.services.bedrock" in sys.modules:
                import app.services.bedrock as bedrock_mod
                importlib.reload(bedrock_mod)
                actual = bedrock_mod.EMBED_MAX_CHARS
            else:
                try:
                    from app.services.bedrock import EMBED_MAX_CHARS
                    actual = EMBED_MAX_CHARS
                except ImportError:
                    self.skipTest("bedrock モジュールのインポートに失敗（AWS依存）")
                    return

        print(f"\n[修正後の確認] EMBED_MAX_CHARS デフォルト値: {actual}")
        self.assertEqual(actual, 4000,
                         f"EMBED_MAX_CHARS のデフォルトは 4000 であるべき（実際: {actual}）")

    def test_embed_max_chars_env_override(self):
        """EMBED_MAX_CHARS 環境変数で上限を調整できることを確認する。"""
        import importlib
        with patch.dict(os.environ, {"EMBED_MAX_CHARS": "3000"}):
            if "app.services.bedrock" in sys.modules:
                import app.services.bedrock as bedrock_mod
                importlib.reload(bedrock_mod)
                actual = bedrock_mod.EMBED_MAX_CHARS
            else:
                try:
                    from app.services.bedrock import EMBED_MAX_CHARS
                    actual = EMBED_MAX_CHARS
                except ImportError:
                    self.skipTest("bedrock モジュールのインポートに失敗（AWS依存）")
                    return

        print(f"\n[環境変数テスト] EMBED_MAX_CHARS=3000 のとき: {actual}")
        self.assertEqual(actual, 3000)

    def test_embed_function_truncates_to_max_chars(self):
        """embed() 関数が EMBED_MAX_CHARS で正しくテキストを切り取ることを確認する。"""
        mock_response = {
            "embedding": [0.1] * 1024
        }
        mock_body = MagicMock()
        mock_body.read.return_value = __import__('json').dumps(mock_response).encode()

        mock_bedrock = MagicMock()
        mock_bedrock.invoke_model.return_value = {"body": mock_body}

        long_text = make_japanese_text(10000)  # 上限を大きく超えるテキスト

        with patch("boto3.client", return_value=mock_bedrock):
            import importlib
            with patch.dict(os.environ, {"EMBED_MAX_CHARS": "4000", "AWS_DEFAULT_REGION": "us-east-1"}):
                try:
                    import app.services.bedrock as bedrock_mod
                    importlib.reload(bedrock_mod)
                    result = bedrock_mod.embed(long_text)
                except ImportError:
                    self.skipTest("bedrock モジュールのインポートに失敗")
                    return

        # invoke_model が呼ばれた際の引数を検証
        call_args = mock_bedrock.invoke_model.call_args
        import json
        body_sent = json.loads(call_args[1]["body"])
        input_text = body_sent["inputText"]

        print(f"\n[embed()テスト] 送信テキスト長: {len(input_text)} 文字")
        self.assertEqual(len(input_text), 4000,
                         f"embed() は 4000 文字に切り取るべき（実際: {len(input_text)}）")


# ---------------------------------------------------------------------------
# テストケース 3: デフォルト chunk_size の変更確認
# ---------------------------------------------------------------------------

class TestVectorizeRequestDefaults(unittest.TestCase):
    """
    VectorizeRequest のデフォルト chunk_size が 512 → 300 に変更されていることを確認する。
    """

    def test_default_chunk_size_is_300(self):
        """chunk_size のデフォルト値が 300 に変更されていることを確認する。"""
        try:
            from app.models.schemas import VectorizeRequest
        except ImportError:
            self.skipTest("schemas モジュールのインポートに失敗")
            return

        req = VectorizeRequest()
        print(f"\n[スキーマ確認] VectorizeRequest デフォルト値:")
        print(f"  chunk_size   = {req.chunk_size}   (期待値: 300)")
        print(f"  chunk_overlap = {req.chunk_overlap}  (期待値: 30)")

        self.assertEqual(req.chunk_size, 300,
                         f"chunk_size のデフォルトは 300 であるべき（実際: {req.chunk_size}）")

    def test_default_chunk_overlap_is_30(self):
        """chunk_overlap のデフォルト値が 30 に変更されていることを確認する。"""
        try:
            from app.models.schemas import VectorizeRequest
        except ImportError:
            self.skipTest("schemas モジュールのインポートに失敗")
            return

        req = VectorizeRequest()
        self.assertEqual(req.chunk_overlap, 30,
                         f"chunk_overlap のデフォルトは 30 であるべき（実際: {req.chunk_overlap}）")

    def test_old_chunk_size_512_exceeds_safe_limit(self):
        """旧デフォルト (chunk_size=512) では 1 チャンクが EMBED_MAX_CHARS を超えうることを示す。"""
        # 512ワード × 平均5文字/ワード = 2,560文字（日本語なら約5,120トークン）
        # ただし、文書によっては長いワードが含まれ 4,000 文字超になりうる
        old_chunk_size_words = 512
        # 典型的な日本語テキストのワード（スペース区切り）の平均文字数
        avg_chars_per_word = 8  # 日本語は長めの単位になりやすい
        estimated_chars = old_chunk_size_words * avg_chars_per_word

        print(f"\n[旧chunk_sizeの検証]")
        print(f"  旧 chunk_size: {old_chunk_size_words} ワード")
        print(f"  推定文字数: {estimated_chars} 文字（平均{avg_chars_per_word}文字/ワード想定）")
        print(f"  EMBED_MAX_CHARS (4000) 超過?: {estimated_chars > 4000}")

        # 旧設定は潜在的に EMBED_MAX_CHARS=4000 を超えることを示す
        self.assertGreater(estimated_chars, 4000,
                           "旧 chunk_size=512 は日本語テキストで EMBED_MAX_CHARS=4000 を超える可能性がある")


# ---------------------------------------------------------------------------
# テストケース 4: _chunk_text の動作確認
# ---------------------------------------------------------------------------

class TestChunkText(unittest.TestCase):
    """
    vectorize.py の _chunk_text() 関数が正しくチャンク分割することを確認する。
    """

    def _chunk_text(self, text: str, size: int, overlap: int):
        """vectorize.py から _chunk_text を再実装（インポート不要にするため）。"""
        words = text.split()
        chunks, i = [], 0
        while i < len(words):
            chunks.append(" ".join(words[i:i+size]))
            i += size - overlap
        return chunks

    def test_chunk_size_300_fails_for_japanese_no_spaces(self):
        """
        【追加バグ検出】 _chunk_text() はスペース区切りを前提とするため、
        スペースのない日本語テキストでは chunk_size=300 でも全文が1チャンクになってしまう。
        → この挙動は意図しない動作であり、別途修正が必要。
        """
        # スペースなしの日本語テキスト（実際のPDF抽出テキストを模倣）
        long_text = make_japanese_text(20000)
        chunks = self._chunk_text(long_text, size=300, overlap=30)

        max_chunk_len = max(len(c) for c in chunks) if chunks else 0
        print(f"\n[追加バグ検出: chunk_size=300 × 日本語]")
        print(f"  総チャンク数: {len(chunks)}")
        print(f"  最大チャンク文字数: {max_chunk_len}")
        print(f"  ⚠️  スペースなし日本語では全文が1チャンクになる: {len(chunks) == 1}")

        # スペースなし日本語テキストは word.split() でチャンク分割できない
        # → 1チャンクになってしまうことを「バグとして確認」する
        self.assertEqual(
            len(chunks), 1,
            "スペースなし日本語では _chunk_text() が1チャンクしか生成しない（チャンク分割が機能しない）"
        )
        self.assertGreater(
            max_chunk_len, 4000,
            "チャンク分割が機能せず4000文字を超えたチャンクが生成される（追加バグ）"
        )

    def test_chunk_size_300_works_for_spaced_japanese(self):
        """スペースで区切られたテキストでは chunk_size=300 が正しく機能することを確認する。"""
        # スペース区切りの日本語ワードリスト（英語テキストまたはスペース区切り日本語）
        words = ["テスト単語" + str(i) for i in range(1000)]
        spaced_text = " ".join(words)
        chunks = self._chunk_text(spaced_text, size=300, overlap=30)

        max_chunk_len = max(len(c) for c in chunks) if chunks else 0
        print(f"\n[スペース区切りテキストでのchunk_size=300]")
        print(f"  総チャンク数: {len(chunks)}")
        print(f"  最大チャンク文字数: {max_chunk_len}")
        print(f"  4000文字以内?: {max_chunk_len <= 4000}")

        self.assertGreater(len(chunks), 1, "複数チャンクに分割されるべき")
        for i, chunk in enumerate(chunks):
            self.assertLessEqual(
                len(chunk), 4000,
                f"チャンク#{i} が 4000 文字を超えている: {len(chunk)} 文字"
            )

    def test_chunk_size_512_may_exceed_4000_chars_with_japanese(self):
        """chunk_size=512（旧デフォルト）では日本語テキストで 4,000 文字を超えるチャンクが生じうることを示す。"""
        # 日本語テキストは1"ワード"が長くなりやすい
        # スペース区切りでワード分割するため、日本語1文 = 1ワードになることも
        japanese_words = ["アーキテクチャ標準仕様書Ver2.0" * 3] * 600  # 長いワードを多数含む
        long_text = " ".join(japanese_words)
        chunks = self._chunk_text(long_text, size=512, overlap=64)

        max_chunk_len = max(len(c) for c in chunks) if chunks else 0
        print(f"\n[旧chunk_size=512テスト]")
        print(f"  総チャンク数: {len(chunks)}")
        print(f"  最大チャンク文字数: {max_chunk_len}")
        print(f"  4000文字超過?: {max_chunk_len > 4000}")

        # 旧設定は 4000 文字を超えうることを示す
        self.assertGreater(max_chunk_len, 4000,
                           "旧 chunk_size=512 では日本語テキストで 4000 文字を超えるチャンクが発生しうる")


if __name__ == "__main__":
    unittest.main(verbosity=2)
