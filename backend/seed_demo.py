#!/usr/bin/env python3
"""
デモデータ作成スクリプト

小さなカフェ「シフトカフェ」を想定したデモデータを作成します。
複数パターンのシフト表を含みます。

使い方:
    uv run python seed_demo.py [--reset]

オプション:
    --reset  既存のデータをすべて削除してから作成
"""

import sys
import json
from datetime import date, timedelta
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000"


def api(method: str, path: str, data: dict | None = None) -> dict | list:
    url = f"{BASE_URL}{path}"
    body = json.dumps(data).encode() if data else None
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        print(f"  ERROR {method} {path}: {e.code} {e.read().decode()}", file=sys.stderr)
        raise


def weekdays_in_month(year: int, month: int):
    """月の全日付を返す"""
    d = date(year, month, 1)
    days = []
    while d.month == month:
        days.append(d)
        d += timedelta(days=1)
    return days


def reset_data():
    """既存データを SQLite DB から直接削除する"""
    import sqlite3
    import os

    db_path = os.path.join(os.path.dirname(__file__), "shift_scheduling.db")
    if not os.path.exists(db_path):
        print("  DB ファイルが見つかりません（スキップ）")
        return

    print("既存データを削除中...")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    tables = [
        "schedule_assignments",
        "staff_requests",
        "role_staffing_requirements",
        "staffing_requirements",
        "schedule_periods",
        "shift_slots",
        "staff",
        "solver_config",
    ]
    total = 0
    for t in tables:
        c.execute(f"DELETE FROM {t}")
        total += c.rowcount
    conn.commit()
    conn.close()
    print(f"  ✓ 全データ削除完了（{total} 件）")


def main():
    reset = "--reset" in sys.argv

    # 接続確認
    try:
        api("GET", "/api/health")
    except Exception:
        print("ERROR: バックエンドに接続できません。")
        print("  先にバックエンドを起動してください:")
        print("  cd backend && uv run python -m uvicorn backend.main:app --port 8000")
        sys.exit(1)

    if reset:
        reset_data()
    else:
        # 既存データがある場合は警告
        staff = api("GET", "/api/staff")
        if staff:
            print(f"警告: すでに {len(staff)} 人のスタッフが存在します。")
            print("  上書きせずに追記します。--reset オプションで先に削除できます。")
            print()

    # ========== 1. スタッフ登録 ==========
    print("① スタッフを登録中...")
    staff_defs = [
        {"name": "田中 太郎",   "role": "社員",       "max_days_per_week": 5, "min_days_per_week": 0},
        {"name": "鈴木 花子",   "role": "社員",       "max_days_per_week": 5, "min_days_per_week": 0},
        {"name": "佐藤 健",     "role": "パート",     "max_days_per_week": 4, "min_days_per_week": 0},
        {"name": "山田 由美",   "role": "パート",     "max_days_per_week": 4, "min_days_per_week": 0},
        {"name": "中村 拓也",   "role": "パート",     "max_days_per_week": 3, "min_days_per_week": 0},
        {"name": "小林 あやか", "role": "アルバイト", "max_days_per_week": 3, "min_days_per_week": 0},
        {"name": "伊藤 誠",     "role": "アルバイト", "max_days_per_week": 3, "min_days_per_week": 0},
        {"name": "渡辺 さくら", "role": "アルバイト", "max_days_per_week": 2, "min_days_per_week": 0},
    ]
    staff_list = []
    for s in staff_defs:
        result = api("POST", "/api/staff", s)
        staff_list.append(result)
        print(f"  ✓ {s['name']} ({s['role']})")

    # ID を名前で引けるように
    staff_by_name = {s["name"]: s for s in staff_list}

    # ========== 2. シフト枠登録 ==========
    print("\n② シフト枠を登録中...")
    slot_defs = [
        {"name": "早番", "start_time": "08:00", "end_time": "15:00"},
        {"name": "中番", "start_time": "11:00", "end_time": "18:00"},
        {"name": "遅番", "start_time": "15:00", "end_time": "22:00"},
    ]
    slot_list = []
    for s in slot_defs:
        result = api("POST", "/api/shift-slots", s)
        slot_list.append(result)
        print(f"  ✓ {s['name']}（{s['start_time']}〜{s['end_time']}）")

    slot_by_name = {s["name"]: s for s in slot_list}

    # ========== 3. 必要人数設定 ==========
    print("\n③ 必要人数を設定中...")
    req_defs = [
        # 早番: 平日1人・休日2人
        {"shift_slot_id": slot_by_name["早番"]["id"], "day_type": "weekday", "min_count": 1},
        {"shift_slot_id": slot_by_name["早番"]["id"], "day_type": "weekend", "min_count": 2},
        # 中番: 平日1人・休日1人
        {"shift_slot_id": slot_by_name["中番"]["id"], "day_type": "weekday", "min_count": 1},
        {"shift_slot_id": slot_by_name["中番"]["id"], "day_type": "weekend", "min_count": 1},
        # 遅番: 平日1人・休日2人
        {"shift_slot_id": slot_by_name["遅番"]["id"], "day_type": "weekday", "min_count": 1},
        {"shift_slot_id": slot_by_name["遅番"]["id"], "day_type": "weekend", "min_count": 2},
    ]
    for r in req_defs:
        api("POST", "/api/staffing-requirements", r)
    print("  ✓ 早番・中番・遅番（平日/休日）の必要人数を設定")

    # ========== 4. スケジュール期間を作成 ==========

    # --- パターン1: 2025年12月（公開済み・シンプル）---
    print("\n④ 2025年12月のシフト（公開済み）を作成中...")
    p1 = api("POST", "/api/schedules", {"start_date": "2025-12-01", "end_date": "2025-12-31"})
    r1 = api("POST", f"/api/schedules/{p1['id']}/optimize")
    if r1["status"] == "optimal":
        api("PUT", f"/api/schedules/{p1['id']}/publish")
        print("  ✓ 最適化・公開完了")
    else:
        print(f"  △ 最適化: {r1['status']} — {r1.get('message', '')}")

    # --- パターン2: 2026年1月（公開済み・祝日あり）---
    print("\n⑤ 2026年1月のシフト（公開済み・祝日あり）を作成中...")
    p2 = api("POST", "/api/schedules", {"start_date": "2026-01-01", "end_date": "2026-01-31"})

    # 元日・成人の日などに「不在希望」を入れてリアルなデータに
    jan_unavailable = [
        # 元日: 田中・鈴木が休み希望
        {"staff_id": staff_by_name["田中 太郎"]["id"], "date": "2026-01-01", "type": "unavailable"},
        {"staff_id": staff_by_name["鈴木 花子"]["id"], "date": "2026-01-01", "type": "unavailable"},
        # 1/3: 佐藤が早番希望
        {"staff_id": staff_by_name["佐藤 健"]["id"],   "date": "2026-01-03", "type": "preferred",
         "shift_slot_id": slot_by_name["早番"]["id"]},
        # アルバイト陣は週末不在が多め
        {"staff_id": staff_by_name["小林 あやか"]["id"], "date": "2026-01-10", "type": "unavailable"},
        {"staff_id": staff_by_name["伊藤 誠"]["id"],     "date": "2026-01-10", "type": "unavailable"},
        {"staff_id": staff_by_name["渡辺 さくら"]["id"], "date": "2026-01-11", "type": "unavailable"},
        {"staff_id": staff_by_name["渡辺 さくら"]["id"], "date": "2026-01-17", "type": "unavailable"},
        {"staff_id": staff_by_name["渡辺 さくら"]["id"], "date": "2026-01-18", "type": "unavailable"},
        {"staff_id": staff_by_name["渡辺 さくら"]["id"], "date": "2026-01-24", "type": "unavailable"},
        {"staff_id": staff_by_name["渡辺 さくら"]["id"], "date": "2026-01-25", "type": "unavailable"},
    ]
    api("POST", "/api/requests", {"period_id": p2["id"], "requests": jan_unavailable})

    r2 = api("POST", f"/api/schedules/{p2['id']}/optimize")
    if r2["status"] == "optimal":
        api("PUT", f"/api/schedules/{p2['id']}/publish")
        print("  ✓ 最適化・公開完了（希望反映あり）")
    else:
        print(f"  △ 最適化: {r2['status']} — {r2.get('message', '')}")

    # --- パターン3: 2026年2月（下書き・希望反映・手動編集あり）---
    print("\n⑥ 2026年2月のシフト（下書き・希望入力済み）を作成中...")
    p3 = api("POST", "/api/schedules", {"start_date": "2026-02-01", "end_date": "2026-02-28"})

    feb_requests = [
        # 田中: 月曜は早番希望
        {"staff_id": staff_by_name["田中 太郎"]["id"], "date": "2026-02-02", "type": "preferred",
         "shift_slot_id": slot_by_name["早番"]["id"]},
        {"staff_id": staff_by_name["田中 太郎"]["id"], "date": "2026-02-09", "type": "preferred",
         "shift_slot_id": slot_by_name["早番"]["id"]},
        {"staff_id": staff_by_name["田中 太郎"]["id"], "date": "2026-02-16", "type": "preferred",
         "shift_slot_id": slot_by_name["早番"]["id"]},
        {"staff_id": staff_by_name["田中 太郎"]["id"], "date": "2026-02-23", "type": "preferred",
         "shift_slot_id": slot_by_name["早番"]["id"]},
        # 鈴木: 2/14（バレンタイン）不在
        {"staff_id": staff_by_name["鈴木 花子"]["id"], "date": "2026-02-14", "type": "unavailable"},
        # 鈴木: 遅番を多めに希望
        {"staff_id": staff_by_name["鈴木 花子"]["id"], "date": "2026-02-04", "type": "preferred",
         "shift_slot_id": slot_by_name["遅番"]["id"]},
        {"staff_id": staff_by_name["鈴木 花子"]["id"], "date": "2026-02-11", "type": "preferred",
         "shift_slot_id": slot_by_name["遅番"]["id"]},
        {"staff_id": staff_by_name["鈴木 花子"]["id"], "date": "2026-02-18", "type": "preferred",
         "shift_slot_id": slot_by_name["遅番"]["id"]},
        # 佐藤: 週末不在（子育て中）
        {"staff_id": staff_by_name["佐藤 健"]["id"], "date": "2026-02-07", "type": "unavailable"},
        {"staff_id": staff_by_name["佐藤 健"]["id"], "date": "2026-02-08", "type": "unavailable"},
        {"staff_id": staff_by_name["佐藤 健"]["id"], "date": "2026-02-14", "type": "unavailable"},
        {"staff_id": staff_by_name["佐藤 健"]["id"], "date": "2026-02-15", "type": "unavailable"},
        {"staff_id": staff_by_name["佐藤 健"]["id"], "date": "2026-02-21", "type": "unavailable"},
        {"staff_id": staff_by_name["佐藤 健"]["id"], "date": "2026-02-22", "type": "unavailable"},
        # 中村: 2/23, 2/24（連休）不在
        {"staff_id": staff_by_name["中村 拓也"]["id"], "date": "2026-02-23", "type": "unavailable"},
        {"staff_id": staff_by_name["中村 拓也"]["id"], "date": "2026-02-24", "type": "unavailable"},
        # 渡辺: 大学の試験期間で2/16-2/20不在
        {"staff_id": staff_by_name["渡辺 さくら"]["id"], "date": "2026-02-16", "type": "unavailable"},
        {"staff_id": staff_by_name["渡辺 さくら"]["id"], "date": "2026-02-17", "type": "unavailable"},
        {"staff_id": staff_by_name["渡辺 さくら"]["id"], "date": "2026-02-18", "type": "unavailable"},
        {"staff_id": staff_by_name["渡辺 さくら"]["id"], "date": "2026-02-19", "type": "unavailable"},
        {"staff_id": staff_by_name["渡辺 さくら"]["id"], "date": "2026-02-20", "type": "unavailable"},
    ]
    api("POST", "/api/requests", {"period_id": p3["id"], "requests": feb_requests})

    r3 = api("POST", f"/api/schedules/{p3['id']}/optimize")
    if r3["status"] == "optimal":
        print(f"  ✓ 最適化完了（下書き保存・希望反映済み）")
    else:
        print(f"  △ 最適化: {r3['status']} — {r3.get('message', '')}")

    # --- パターン4: 2026年3月（未最適化・空の下書き）---
    print("\n⑦ 2026年3月のシフト（未最適化）を作成中...")
    api("POST", "/api/schedules", {"start_date": "2026-03-01", "end_date": "2026-03-31"})
    print("  ✓ 期間のみ作成（最適化は未実行）")

    # ========== 完了 ==========
    print("\n" + "=" * 50)
    print("デモデータの作成が完了しました！")
    print("=" * 50)
    print()
    print("作成したデータ:")
    print(f"  スタッフ     : {len(staff_list)} 人")
    print(f"  シフト枠     : {len(slot_list)} 種類（早番・中番・遅番）")
    print()
    print("  シフト表:")
    print("  [公開済み] 2025年12月 — シンプルなシフト")
    print("  [公開済み] 2026年 1月 — 祝日・希望入力あり")
    print("  [下書き]   2026年 2月 — 希望入力済み・最適化済み（現在閲覧可）")
    print("  [下書き]   2026年 3月 — 空の状態（これから最適化を試せる）")
    print()
    print("  ブラウザで確認: http://localhost:3001/schedule")


if __name__ == "__main__":
    main()
