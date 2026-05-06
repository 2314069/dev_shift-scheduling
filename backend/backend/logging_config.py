"""ログマスキング設定モジュール。

Python 標準 logging の Filter を使い、ログ出力前に個人情報を伏せる。
既存のログ呼び出しを変更せず、Filter で透過的にマスクすることで
defense-in-depth（多層防御）を実現する。

マスキング対象:
  - メールアドレス（RFC 5321 ローカルパート + ドメインを個別マスク）
  - Magic Link / verification_token（長い英数字 hex またはランダム文字列）
  - JWE トークン本体（Base64URL エンコードされた compact serialization 形式）
  - クエリパラメータ内の email= / token= / identifier= の値
"""

import logging
import logging.config
import re
from typing import Any

# ---------------------------------------------------------------------------
# マスキング正規表現パターン
# ---------------------------------------------------------------------------

# メールアドレス: ローカルパートを u*** に、ドメイン先頭部分を d*** に変換する。
# RFC 5321 に準拠した広範なパターン（quoted-string は除外）。
# グループ 1 = ローカルパート先頭文字, グループ 2 = 残りローカルパート,
# グループ 3 = ドメイン先頭文字, グループ 4 = 残りドメイン部分
_EMAIL_RE = re.compile(
    r"([A-Za-z0-9._%+\-]{1})"  # ローカルパート先頭 1 文字
    r"([A-Za-z0-9._%+\-]+)"  # ローカルパート残り（必須）
    r"@"
    r"([A-Za-z0-9\-]{1})"  # ドメイン先頭 1 文字
    r"([A-Za-z0-9.\-]+)"  # ドメイン残り
)

# JWE compact serialization: base64url.base64url.base64url.base64url.base64url
# 5 つのピリオド区切りセグメントを持つ長い文字列。
_JWE_RE = re.compile(
    r"ey[A-Za-z0-9\-_]{10,}"  # JWE/JWT は 'ey' で始まる base64url
    r"(?:\.[A-Za-z0-9\-_]*){4}"  # . で区切られた残り 4 セグメント（空も許容）
)

# Magic Link / verification_token: 32 文字以上の hex または URL-safe 英数字文字列。
# JWE より先に評価するとオーバーラップするため、JWE の後に適用する。
_TOKEN_RE = re.compile(r"[A-Za-z0-9\-_]{32,}")

# クエリパラメータのマスキング: email=... token=... identifier=...
# URLのクエリストリング内に含まれる個人情報をキーベースでマスク。
_QUERY_PARAM_RE = re.compile(
    r"(?i)"  # 大文字小文字を区別しない
    r"(?<=[?&])"  # ? または & の後（ゼロ幅後読み）
    r"(email|token|identifier|callbackUrl)"  # パラメータ名
    r"(=)"
    r"([^&\s\"']{1,})"  # パラメータ値（& やスペースの前まで）
)


def _mask_email(text: str) -> str:
    """メールアドレスをマスクする。

    例: user@example.com → u***@e***.com
    ローカルパートの先頭 1 文字を残し、残りを *** で置換。
    ドメインの先頭 1 文字を残し、残りを *** で置換（TLD は保持しない）。
    """

    def _replace(m: re.Match) -> str:
        local_first = m.group(1)
        domain_first = m.group(3)
        return f"{local_first}***@{domain_first}***.***"

    return _EMAIL_RE.sub(_replace, text)


def _mask_jwe(text: str) -> str:
    """JWE compact serialization トークンをマスクする。

    例: eyJhbGciOiJkaXIi....<4 segments> → [JWE_TOKEN]
    """
    return _JWE_RE.sub("[JWE_TOKEN]", text)


def _mask_token(text: str) -> str:
    """Magic Link / verification_token 等の長い英数字トークンをマスクする。

    32 文字以上の連続した英数字ハイフンアンダースコア列を対象とする。
    JWE マスク後に呼ぶことで JWE プレースホルダーを保護する。
    """
    return _TOKEN_RE.sub("[TOKEN]", text)


def _mask_query_params(text: str) -> str:
    """URL クエリパラメータの個人情報フィールド値をマスクする。

    例: ?email=user%40example.com&foo=bar → ?email=[MASKED]&foo=bar
    ただし [JWE_TOKEN] / [TOKEN] プレースホルダー化済みの値は対象外。
    """

    def _replace(m: re.Match) -> str:
        value = m.group(3)
        # 既にマスク済みのプレースホルダーはそのまま返す
        if value.startswith("[") and value.endswith("]"):
            return m.group(1) + m.group(2) + value
        return m.group(1) + m.group(2) + "[MASKED]"

    return _QUERY_PARAM_RE.sub(_replace, text)


def mask_sensitive(text: str) -> str:
    """テキスト内の個人情報・機密情報をまとめてマスクする。

    適用順序:
    1. JWE トークン（最も長い文字列を先にキャプチャ）
    2. URL クエリパラメータ内の token= / email= 等（JWE マスク後に適用）
    3. メールアドレス（クエリパラメータマスク後に残るメールを処理）
    4. 長いトークン文字列（その他の認証トークン）
    """
    text = _mask_jwe(text)
    text = _mask_query_params(text)
    text = _mask_email(text)
    text = _mask_token(text)
    return text


# ---------------------------------------------------------------------------
# logging.Filter 実装
# ---------------------------------------------------------------------------


class SensitiveDataFilter(logging.Filter):
    """ログレコードのメッセージと exc_info 内の個人情報をマスクするフィルター。

    logging.Filter.filter() は False を返すとログを破棄するが、
    本クラスは常に True を返してマスク済みメッセージを通過させる。
    """

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        # フォーマット前のメッセージ引数をマスクする。
        # record.getMessage() でフォーマット済み文字列を取ることもできるが、
        # 引数を個別にマスクする方が将来的な拡張に対して安全。
        record.msg = mask_sensitive(str(record.msg))

        if record.args:
            if isinstance(record.args, dict):
                record.args = {
                    k: mask_sensitive(str(v)) if isinstance(v, str) else v
                    for k, v in record.args.items()
                }
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    mask_sensitive(str(a)) if isinstance(a, str) else a
                    for a in record.args
                )

        # Pydantic バリデーションエラー等で exc_text に個人情報が乗る場合に対応。
        # exc_text はキャッシュされた文字列形式の例外情報。
        if record.exc_text:
            record.exc_text = mask_sensitive(record.exc_text)

        return True


# ---------------------------------------------------------------------------
# dictConfig 定義
# ---------------------------------------------------------------------------

LOGGING_CONFIG: dict[str, Any] = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "sensitive_data": {
            "()": "backend.logging_config.SensitiveDataFilter",
        },
    },
    "formatters": {
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": "%(levelprefix)s %(message)s",
            "use_colors": None,
        },
        "access": {
            "()": "uvicorn.logging.AccessFormatter",
            "fmt": '%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
            "filters": ["sensitive_data"],
        },
        "access": {
            "formatter": "access",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "filters": ["sensitive_data"],
        },
    },
    "loggers": {
        "uvicorn": {
            "handlers": ["default"],
            "level": "INFO",
            "propagate": False,
        },
        "uvicorn.error": {
            "level": "INFO",
        },
        "uvicorn.access": {
            "handlers": ["access"],
            "level": "INFO",
            "propagate": False,
        },
        # FastAPI / Starlette は "fastapi" ロガーを使わないが念のため設定
        "fastapi": {
            "handlers": ["default"],
            "level": "INFO",
            "propagate": False,
        },
    },
    # ルートロガーにもフィルターを適用してカスタムコードのログも保護する
    "root": {
        "handlers": ["default"],
        "level": "WARNING",
        "filters": ["sensitive_data"],
    },
}


def configure_logging() -> None:
    """LOGGING_CONFIG を dictConfig に適用する。

    main.py のモジュールレベルで呼び出す（アプリ起動時に 1 回だけ実行）。
    uvicorn が独自に logging.config.dictConfig を呼ぶ前に適用するため、
    uvicorn の log_config 引数として渡すことを推奨する。
    """
    logging.config.dictConfig(LOGGING_CONFIG)
