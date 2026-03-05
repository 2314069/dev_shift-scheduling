# Staff View & Cross-Month Consecutive Days Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) スタッフが公開済みシフトを閲覧できる `/view` ページを追加する。(2) 月またぎ連続勤務を最適化制約に組み込む。

**Architecture:** フロントエンド3ファイル変更（ナビ・ShiftCalendar props拡張・新規ページ）とバックエンド3ファイル変更（リポジトリ・サービス・ソルバー）。バックエンドAPIの追加なし。

**Tech Stack:** Next.js/TypeScript (frontend), FastAPI/SQLAlchemy/PuLP (backend), pytest + Vitest (tests)

---

## Task 1: ナビゲーションに「シフト確認」リンクを追加

**Files:**
- Modify: `frontend/app/layout.tsx`

### Step 1: テストを書く

`frontend/app/layout.tsx` はサーバーコンポーネントなので Vitest での直接テストは不要。
目視確認で OK（Step 2 で確認）。

### Step 2: 変更を実装する

`frontend/app/layout.tsx` の `<nav>` 内に「シフト表」リンクの**前に**追加する:

```tsx
<Link
  href="/view"
  className="text-sm font-medium hover:text-primary"
>
  シフト確認
</Link>
```

変更後の `<nav>` ブロック（37〜57行目を置換）:

```tsx
<nav className="flex gap-6">
  <Link
    href="/settings"
    className="text-sm font-medium hover:text-primary"
  >
    設定
  </Link>
  <Link
    href="/staff"
    className="text-sm font-medium hover:text-primary"
  >
    希望入力
  </Link>
  <Link
    href="/view"
    className="text-sm font-medium hover:text-primary"
  >
    シフト確認
  </Link>
  <Link
    href="/schedule"
    className="text-sm font-medium hover:text-primary"
  >
    シフト表
  </Link>
</nav>
```

### Step 3: コミット

```bash
git add frontend/app/layout.tsx
git commit -m "feat: add シフト確認 link to navigation"
```

---

## Task 2: ShiftCalendar に highlightStaffId prop を追加

**Files:**
- Modify: `frontend/components/shift-calendar.tsx`

### Step 1: テストファイルを確認

既存テスト: `frontend/components/__tests__/` にあるか確認してから進む。
ShiftCalendar のテストが存在すれば、そこに以下を追加。存在しなければスキップして実装のみ。

### Step 2: props インターフェースに追加

`shift-calendar.tsx` の `ShiftCalendarProps` インターフェース（61〜72行目）に `highlightStaffId?: number` を追加:

```tsx
interface ShiftCalendarProps {
  periodId: number;
  startDate: string;
  endDate: string;
  staffList: Staff[];
  shiftSlots: ShiftSlot[];
  assignments: ScheduleAssignment[];
  requirements: StaffingRequirement[];
  staffRequests: StaffRequest[];
  isPublished: boolean;
  onAssignmentUpdated: () => void;
  highlightStaffId?: number;  // 追加
}
```

### Step 3: 関数シグネチャに追加

`ShiftCalendar` 関数（74〜85行目）のデストラクチャに追加:

```tsx
export function ShiftCalendar({
  periodId,
  startDate,
  endDate,
  staffList,
  shiftSlots,
  assignments,
  requirements,
  staffRequests,
  isPublished,
  onAssignmentUpdated,
  highlightStaffId,  // 追加
}: ShiftCalendarProps) {
```

### Step 4: スタッフ行にハイライトを適用

ShiftCalendar 内でスタッフごとの行を描画している箇所（`staffList.map` の行レベル `<tr>` や `<div>`）を探し、ハイライト用のクラスを条件付きで追加する。

スタッフ行を描画している行の `className` に以下を追加:

```tsx
className={`... ${highlightStaffId === s.id ? "bg-yellow-50 ring-1 ring-inset ring-yellow-300" : ""}`}
```

具体的には、`staffList.map((s) => ...)` 内でスタッフ名を含む行の `<tr>` または最外 `<div>` を見つけ、上記条件クラスを追加する。

### Step 5: フロントエンドテスト実行

```bash
cd frontend && npm run test -- --run
```

期待: 既存テストがすべて PASS（新 prop はオプショナルなので既存テストに影響なし）

### Step 6: コミット

```bash
git add frontend/components/shift-calendar.tsx
git commit -m "feat: add highlightStaffId prop to ShiftCalendar"
```

---

## Task 3: スタッフ向け閲覧ページ `/view` を作成

**Files:**
- Create: `frontend/app/view/page.tsx`

### Step 1: ページを作成

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type {
  Staff,
  ShiftSlot,
  SchedulePeriod,
  ScheduleAssignment,
  ScheduleResponse,
  StaffingRequirement,
  StaffRequest,
} from "@/lib/types";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShiftCalendar } from "@/components/shift-calendar";

export default function ViewPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([]);
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [requirements, setRequirements] = useState<StaffingRequirement[]>([]);

  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [staffRequests, setStaffRequests] = useState<StaffRequest[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<SchedulePeriod | null>(null);
  const [loading, setLoading] = useState(false);

  // 参照データ取得（スタッフ・シフト枠・必要人数・公開済み期間）
  useEffect(() => {
    async function fetchData() {
      try {
        const [staffData, slotsData, periodsData, reqData] = await Promise.all([
          apiFetch<Staff[]>("/api/staff"),
          apiFetch<ShiftSlot[]>("/api/shift-slots"),
          apiFetch<SchedulePeriod[]>("/api/schedules"),
          apiFetch<StaffingRequirement[]>("/api/staffing-requirements"),
        ]);
        setStaffList(staffData);
        setShiftSlots(slotsData);
        // 公開済みのみ表示
        setPeriods(periodsData.filter((p) => p.status === "published"));
        setRequirements(reqData);
      } catch (e) {
        console.error(e);
        toast.error("データの取得に失敗しました");
      }
    }
    fetchData();
  }, []);

  // 期間選択時にシフト表を取得
  const fetchSchedule = useCallback(async (periodId: string) => {
    if (!periodId) return;
    try {
      setLoading(true);
      const [scheduleData, requestsData] = await Promise.all([
        apiFetch<ScheduleResponse>(`/api/schedules/${periodId}`),
        apiFetch<StaffRequest[]>(`/api/requests?period_id=${periodId}`),
      ]);
      setSelectedPeriod(scheduleData.period);
      setAssignments(scheduleData.assignments);
      setStaffRequests(requestsData);
    } catch (e) {
      console.error(e);
      toast.error("シフト表の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchSchedule(selectedPeriodId);
    } else {
      setSelectedPeriod(null);
      setAssignments([]);
      setStaffRequests([]);
    }
  }, [selectedPeriodId, fetchSchedule]);

  const highlightStaffId = selectedStaffId ? Number(selectedStaffId) : undefined;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">シフト確認</h1>

      <Card>
        <CardHeader>
          <CardTitle>表示設定</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium">自分の名前</label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="スタッフを選択" />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">期間</label>
            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="期間を選択（公開済みのみ）" />
              </SelectTrigger>
              <SelectContent>
                {periods.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    公開済みのシフトがありません
                  </SelectItem>
                ) : (
                  periods.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.start_date} 〜 {p.end_date}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedPeriod && (
        <Card>
          <CardHeader>
            <CardTitle>
              シフト表 ({selectedPeriod.start_date} 〜 {selectedPeriod.end_date})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">読み込み中...</p>
            ) : (
              <ShiftCalendar
                periodId={selectedPeriod.id}
                startDate={selectedPeriod.start_date}
                endDate={selectedPeriod.end_date}
                staffList={staffList}
                shiftSlots={shiftSlots}
                assignments={assignments}
                requirements={requirements}
                staffRequests={staffRequests}
                isPublished={true}
                onAssignmentUpdated={() => {}}
                highlightStaffId={highlightStaffId}
              />
            )}
          </CardContent>
        </Card>
      )}

      {!selectedPeriod && periods.length === 0 && (
        <p className="text-muted-foreground text-sm">
          まだ公開されたシフトがありません。管理者がシフトを公開するまでお待ちください。
        </p>
      )}
    </div>
  );
}
```

### Step 2: フロントエンドテスト実行

```bash
cd frontend && npm run test -- --run
```

期待: 全テスト PASS

### Step 3: コミット

```bash
git add frontend/app/view/page.tsx
git commit -m "feat: add staff view page /view for published schedules"
```

---

## Task 4: ScheduleRepository に直前公開期間検索メソッドを追加

**Files:**
- Modify: `backend/backend/repositories/schedule.py`
- Test: `backend/tests/test_optimizer.py` または `test_api_schedules.py`

### Step 1: テストを書く

`backend/tests/test_api_schedules.py` に以下のテストを追加:

```python
def test_get_published_period_ending_before(client, db_session):
    """直前に公開済み期間が存在する場合に返すことを確認"""
    from datetime import date
    from backend.models import SchedulePeriodModel

    # 公開済み期間（3月）を作成
    march = SchedulePeriodModel(
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 31),
        status="published",
    )
    db_session.add(march)
    db_session.commit()

    from backend.repositories import ScheduleRepository
    repo = ScheduleRepository(db_session)

    # 4月のスケジュールを最適化する際に3月を見つける
    result = repo.get_published_period_ending_before(date(2026, 4, 1))
    assert result is not None
    assert result.end_date == date(2026, 3, 31)

def test_get_published_period_ending_before_not_found(client, db_session):
    """直前に公開済み期間がない場合は None を返すことを確認"""
    from datetime import date
    from backend.repositories import ScheduleRepository
    repo = ScheduleRepository(db_session)
    result = repo.get_published_period_ending_before(date(2026, 4, 1))
    assert result is None
```

### Step 2: テストを実行して失敗することを確認

```bash
cd backend && uv run python -m pytest tests/test_api_schedules.py -k "ending_before" -v
```

期待: FAIL (AttributeError: 'ScheduleRepository' object has no attribute 'get_published_period_ending_before')

### Step 3: 実装

`backend/backend/repositories/schedule.py` の `ScheduleRepository` クラス末尾に追加:

```python
def get_published_period_ending_before(self, start_date: date_type) -> SchedulePeriod | None:
    """start_date の前日を end_date とする公開済み期間を返す"""
    from datetime import timedelta
    target_end = start_date - timedelta(days=1)
    model = (
        self.db.query(SchedulePeriodModel)
        .filter(
            SchedulePeriodModel.end_date == target_end,
            SchedulePeriodModel.status == "published",
        )
        .first()
    )
    return self._to_period_domain(model) if model else None
```

### Step 4: テストを実行して通過することを確認

```bash
cd backend && uv run python -m pytest tests/test_api_schedules.py -k "ending_before" -v
```

期待: PASS

### Step 5: コミット

```bash
git add backend/backend/repositories/schedule.py backend/tests/test_api_schedules.py
git commit -m "feat: add get_published_period_ending_before to ScheduleRepository"
```

---

## Task 5: solver.py に prefix_assignments を追加

**Files:**
- Modify: `backend/backend/optimizer/solver.py`
- Test: `backend/tests/test_optimizer.py`

### Step 1: テストを書く

`backend/tests/test_optimizer.py` に追加:

```python
def test_cross_month_consecutive_days_respected():
    """月またぎの連続勤務制限を確認"""
    from datetime import date, time
    staff_list = [
        Staff(id=1, name="田中", role="一般", max_days_per_week=7),
        Staff(id=2, name="佐藤", role="一般", max_days_per_week=7),
        Staff(id=3, name="鈴木", role="一般", max_days_per_week=7),
    ]
    slots = [ShiftSlot(id=1, name="早番", start_time=time(9, 0), end_time=time(17, 0))]
    requirements = [StaffingRequirement(id=1, shift_slot_id=1, day_type="weekday", min_count=2)]
    # 4月1日〜7日（平日7日間）
    period = SchedulePeriod(id=1, start_date=date(2026, 4, 1), end_date=date(2026, 4, 7))

    # 田中は3月29〜31日（3日間）すでに連続勤務済み。max_consecutive_days=4 なら4月は1日のみ可
    prefix_assignments = {
        1: [date(2026, 3, 29), date(2026, 3, 30), date(2026, 3, 31)],
    }

    config = SolverConfig(
        id=1,
        max_consecutive_days=4,
        time_limit=30,
        min_shift_interval_hours=11,
        enable_preferred_shift=False,
        enable_fairness=False,
        enable_weekend_fairness=False,
        enable_shift_interval=False,
        enable_role_staffing=False,
        enable_min_days_per_week=False,
        enable_soft_staffing=False,
    )

    result = solve_schedule(
        period, staff_list, slots, requirements, [],
        config=config,
        prefix_assignments=prefix_assignments,
    )
    assert result["status"] == "optimal"

    # 田中(id=1)は4月1〜4日の連続が最大1日（前月3日 + 今月1日 = 4日で上限）
    from collections import Counter
    tanaka_dates = sorted(
        a["date"] for a in result["assignments"] if a["staff_id"] == 1
    )
    # 4月1日から連続勤務が1日以内に抑えられているか確認
    # (前月3連勤+今月1日=4日で制限に達するため、4月1日の翌日は休み)
    if "2026-04-01" in tanaka_dates:
        assert "2026-04-02" not in tanaka_dates, "Cross-month consecutive limit violated"
```

### Step 2: テスト実行して失敗を確認

```bash
cd backend && uv run python -m pytest tests/test_optimizer.py::test_cross_month_consecutive_days_respected -v
```

期待: FAIL (TypeError: solve_schedule() got unexpected keyword argument 'prefix_assignments')

### Step 3: solver.py の solve_schedule シグネチャに追加

`backend/backend/optimizer/solver.py` の `solve_schedule` 関数（428行目〜）のシグネチャに追加:

```python
def solve_schedule(
    period: SchedulePeriod,
    staff_list: list[Staff],
    slots: list[ShiftSlot],
    requirements: list[StaffingRequirement],
    requests: list[StaffRequest],
    max_consecutive_days: int = 6,
    time_limit: int = 30,
    config: SolverConfig | None = None,
    role_requirements: list[RoleStaffingRequirement] | None = None,
    _skip_diagnostics: bool = False,
    prefix_assignments: dict[int, list] | None = None,  # 追加
) -> dict:
```

### Step 4: C4 連勤制約を更新

`solver.py` の連勤制限コード（約588〜595行目）を以下のように変更:

**変更前:**
```python
# 制約4: 連勤制限
for s in staff_list:
    for i in range(len(dates) - config.max_consecutive_days):
        window = dates[i : i + config.max_consecutive_days + 1]
        prob += (
            lpSum(x[(s.id, d, t.id)] for d in window for t in slots)
            <= config.max_consecutive_days
        ), f"consec_{s.id}_{dates[i].strftime('%Y%m%d')}"
```

**変更後:**
```python
# 制約4: 連勤制限（月またぎ考慮）
_prefix = prefix_assignments or {}
for s in staff_list:
    for i in range(len(dates) - config.max_consecutive_days):
        window = dates[i : i + config.max_consecutive_days + 1]
        prob += (
            lpSum(x[(s.id, d, t.id)] for d in window for t in slots)
            <= config.max_consecutive_days
        ), f"consec_{s.id}_{dates[i].strftime('%Y%m%d')}"

# 月またぎ: 期間の先頭 max_consecutive_days-1 日間のウィンドウに prefix を加算
if _prefix:
    for s in staff_list:
        prefix_dates = _prefix.get(s.id, [])
        if not prefix_dates:
            continue
        prefix_set = set(prefix_dates)
        for i in range(min(config.max_consecutive_days, len(dates))):
            # 今期の 0..i 日をウィンドウ後半とし、prefix から前半を算出
            current_window = dates[: i + 1]
            # prefix の中で current_window の直前に連続する日数
            prefix_count = 0
            check_date = dates[0] - timedelta(days=1)
            while check_date in prefix_set:
                prefix_count += 1
                check_date -= timedelta(days=1)
                if prefix_count >= config.max_consecutive_days:
                    break
            if prefix_count == 0:
                break
            prob += (
                prefix_count + lpSum(x[(s.id, d, t.id)] for d in current_window for t in slots)
                <= config.max_consecutive_days
            ), f"consec_prefix_{s.id}_{i}"
```

### Step 5: テスト実行して通過を確認

```bash
cd backend && uv run python -m pytest tests/test_optimizer.py -v
```

期待: 全テスト PASS

### Step 6: コミット

```bash
git add backend/backend/optimizer/solver.py backend/tests/test_optimizer.py
git commit -m "feat: add cross-month consecutive days support to solver"
```

---

## Task 6: ScheduleService.optimize() で prefix_assignments を注入

**Files:**
- Modify: `backend/backend/services/schedule.py`

### Step 1: テストを書く

`backend/tests/test_api_optimize.py` に以下を追加（既存テストが壊れていないことも確認）:

```python
def test_optimize_uses_previous_published_period(client, db_session):
    """直前に公開済み期間がある場合、prefix が注入されることを確認（API レベル）"""
    import json
    from datetime import date
    from backend.models import (
        StaffModel, ShiftSlotModel, StaffingRequirementModel,
        SchedulePeriodModel, ScheduleAssignmentModel,
    )
    from datetime import time

    # スタッフ
    s = StaffModel(name="田中", role="一般", max_days_per_week=7, min_days_per_week=0)
    db_session.add(s)
    # シフト枠
    slot = ShiftSlotModel(name="早番", start_time=time(9, 0), end_time=time(17, 0))
    db_session.add(slot)
    db_session.flush()

    req = StaffingRequirementModel(shift_slot_id=slot.id, day_type="weekday", min_count=1)
    db_session.add(req)

    # 前月（公開済み）を作成
    prev = SchedulePeriodModel(
        start_date=date(2026, 3, 1), end_date=date(2026, 3, 31), status="published"
    )
    db_session.add(prev)
    db_session.flush()

    # 今月（draft）
    curr = SchedulePeriodModel(
        start_date=date(2026, 4, 1), end_date=date(2026, 4, 3), status="draft"
    )
    db_session.add(curr)
    db_session.commit()

    response = client.post(f"/api/schedules/{curr.id}/optimize")
    assert response.status_code == 200
    data = response.json()
    # status が "optimal" または infeasible でも 500 にならないことを確認
    assert data["status"] in ("optimal", "infeasible")
```

### Step 2: テスト実行

```bash
cd backend && uv run python -m pytest tests/test_api_optimize.py -v
```

期待: 既存テスト PASS（新テストは現時点で PASS/FAIL どちらでも可）

### Step 3: ScheduleService.optimize() を更新

`backend/backend/services/schedule.py` の `optimize` メソッドを更新:

1. `datetime` import に `timedelta` を追加
2. 直前公開期間を検索してアサインメントから prefix を構築
3. `solve_schedule()` 呼び出しに `prefix_assignments` を渡す

```python
from datetime import date, timedelta  # timedelta を追加

def optimize(self, period_id: int) -> OptimizeResult | None:
    period = self._schedule_repo.get_period(period_id)
    if period is None:
        return None

    self._schedule_repo.delete_auto_assignments(period_id)

    staff_list = self._staff_repo.list_all()
    slots = self._slot_repo.list_all()
    requirements = self._requirement_repo.list_all()
    requests = self._request_repo.list_by_date_range(
        period.start_date, period.end_date
    )
    config = self._config_repo.get_or_create_default()
    role_requirements = self._role_req_repo.list_all()

    # 月またぎ連勤チェック: 直前公開済み期間の末尾勤務実績を取得
    prefix_assignments: dict[int, list] = {}
    prev_period = self._schedule_repo.get_published_period_ending_before(period.start_date)
    if prev_period is not None:
        n = config.max_consecutive_days - 1
        tail_start = prev_period.end_date - timedelta(days=n - 1)
        prev_assignments = self._schedule_repo.get_assignments_by_period(prev_period.id)
        for a in prev_assignments:
            if a.shift_slot_id is not None and a.date >= tail_start:
                prefix_assignments.setdefault(a.staff_id, []).append(a.date)

    result = solve_schedule(
        period=period,
        staff_list=staff_list,
        slots=slots,
        requirements=requirements,
        requests=requests,
        config=config,
        role_requirements=role_requirements,
        prefix_assignments=prefix_assignments if prefix_assignments else None,
    )

    diagnostics = result.get("diagnostics", [])

    if result["status"] == "optimal":
        self._schedule_repo.bulk_create_assignments(
            period_id, result["assignments"]
        )
        saved = self._schedule_repo.get_assignments_by_period(period_id)
        return OptimizeResult(
            status=result["status"],
            message=result["message"],
            assignments=saved,
            diagnostics=diagnostics,
        )

    return OptimizeResult(
        status=result["status"],
        message=result["message"],
        assignments=[],
        diagnostics=diagnostics,
    )
```

### Step 4: 全バックエンドテスト実行

```bash
cd backend && uv run python -m pytest -v
```

期待: 全テスト PASS

### Step 5: コミット

```bash
git add backend/backend/services/schedule.py
git commit -m "feat: inject cross-month prefix_assignments into optimizer"
```

---

## Task 7: STATUS.md を更新してフィニッシュ

### Step 1: STATUS.md を更新

`STATUS.md` の該当箇所を更新:
- 「公開済みシフト表のスタッフ向け閲覧画面」を `[ ]` → `[x]` に
- 「月またぎ連続勤務チェック」を `[ ]` → `[x]` に
- 最近のコミット一覧を更新
- 最終更新日を `2026-02-26` に

### Step 2: 最終コミット

```bash
git add STATUS.md
git commit -m "chore: update STATUS.md for staff view and cross-month consecutive days"
```

---

## チェックリスト

- [ ] Task 1: ナビに「シフト確認」リンク追加
- [ ] Task 2: ShiftCalendar に highlightStaffId prop 追加
- [ ] Task 3: `/view` ページ作成
- [ ] Task 4: `get_published_period_ending_before` をリポジトリに追加
- [ ] Task 5: solver に `prefix_assignments` 対応
- [ ] Task 6: ScheduleService でプレフィックス注入
- [ ] Task 7: STATUS.md 更新
