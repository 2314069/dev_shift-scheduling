import { test, expect } from "@playwright/test";

test("設定画面でシフト枠を新規追加できる", async ({ page }) => {
  await page.goto("/settings");

  // 空状態 -> 「最初のシフト枠を追加」ボタン
  await page.getByRole("button", { name: "最初のシフト枠を追加" }).click();

  // 名前を入力
  await page.getByPlaceholder("例: 早番").fill("E2E 早番");

  // 開始・終了時刻はデフォルトのまま保存
  await page.getByRole("button", { name: "保存" }).click();

  // 追加されたシフト枠がテーブルに表示されること
  await expect(page.getByRole("cell", { name: "E2E 早番" })).toBeVisible();
});
