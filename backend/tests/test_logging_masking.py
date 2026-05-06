"""Phase 1-6 ログマスキングテスト。

backend/backend/logging_config.py の mask_sensitive と SensitiveDataFilter が
個人情報・機密トークンを正しく伏せることを検証する。
"""

import logging

import pytest

from backend.logging_config import (
    SensitiveDataFilter,
    mask_sensitive,
)


class TestMaskEmail:
    """メールアドレスのマスキング。"""

    def test_simple_email_is_masked(self):
        result = mask_sensitive("login attempt: user@example.com")
        assert "user@example.com" not in result
        assert "u***@e***" in result

    def test_email_with_plus_alias_is_masked(self):
        result = mask_sensitive("notify alice+inbox@gmail.com today")
        assert "alice+inbox@gmail.com" not in result
        assert "a***@g***" in result

    def test_email_with_dot_in_localpart_is_masked(self):
        result = mask_sensitive("forwarded from john.doe@example.co.jp")
        assert "john.doe@example.co.jp" not in result
        assert "j***@e***" in result

    def test_multiple_emails_in_one_message_are_all_masked(self):
        result = mask_sensitive("from alice@example.com to bob@example.org")
        assert "alice@example.com" not in result
        assert "bob@example.org" not in result


class TestMaskJWE:
    """JWE トークンのマスキング。"""

    def test_jwe_token_is_masked(self):
        # 5 セグメントの JWE compact serialization
        jwe = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0.aaa.bbb.ccc.ddd"
        result = mask_sensitive(f"Cookie: authjs.session-token={jwe}")
        assert jwe not in result
        assert "[JWE_TOKEN]" in result


class TestMaskToken:
    """汎用トークン（magic link / verification token）のマスキング。"""

    def test_long_hex_token_is_masked(self):
        token = "0123456789abcdef0123456789abcdef0123456789abcdef"
        result = mask_sensitive(f"verifying token={token}")
        # email= や token= はクエリパラメータマスキングで処理されるが
        # 単独の長い hex 列は _TOKEN_RE で [TOKEN] になる
        assert token not in result

    def test_short_string_is_not_masked(self):
        # 32 文字未満は対象外
        result = mask_sensitive("short_id=abc123")
        assert "abc123" in result


class TestMaskQueryParams:
    """URL クエリパラメータのマスキング。"""

    def test_email_param_is_masked(self):
        result = mask_sensitive("/signin?email=user@example.com&next=/")
        assert "user@example.com" not in result
        # email クエリ値は [MASKED]、または email 部分は _mask_email でも処理される
        assert "[MASKED]" in result or "[" in result

    def test_token_param_is_masked(self):
        result = mask_sensitive("/auth/callback?token=abc123def456ghi789&state=foo")
        # token= の値全体が [MASKED] に
        assert "[MASKED]" in result

    def test_callback_url_is_masked(self):
        result = mask_sensitive(
            "/signin?callbackUrl=https%3A%2F%2Fapp.example.com%2Fschedule"
        )
        assert "[MASKED]" in result


class TestMaskNonSensitive:
    """通常メッセージは破壊しない。"""

    def test_plain_text_is_unchanged(self):
        result = mask_sensitive("schedule optimized in 1.23 seconds")
        assert result == "schedule optimized in 1.23 seconds"

    def test_short_identifiers_unchanged(self):
        result = mask_sensitive("status=200 method=GET path=/api/me")
        assert "status=200" in result
        assert "method=GET" in result


class TestSensitiveDataFilter:
    """logging.Filter としての動作。"""

    @pytest.fixture
    def filter_instance(self) -> SensitiveDataFilter:
        return SensitiveDataFilter()

    def _make_record(self, msg: str, args=None) -> logging.LogRecord:
        return logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg=msg,
            args=args,
            exc_info=None,
        )

    def test_filter_masks_email_in_msg(self, filter_instance):
        record = self._make_record("login: user@example.com")
        filter_instance.filter(record)
        assert "user@example.com" not in record.getMessage()

    def test_filter_returns_true(self, filter_instance):
        # フィルタはログを破棄せず True を返す（マスクのみ）
        record = self._make_record("plain message")
        assert filter_instance.filter(record) is True

    def test_filter_masks_args_tuple(self, filter_instance):
        record = self._make_record("user %s logged in", args=("alice@x.com",))
        filter_instance.filter(record)
        # フォーマット後にメールが漏れていない
        assert "alice@x.com" not in record.getMessage()

    def test_filter_does_not_break_non_string_args(self, filter_instance):
        # 数値 args はそのまま通る
        record = self._make_record("count=%d", args=(42,))
        filter_instance.filter(record)
        assert "42" in record.getMessage()
