import { test, expect } from "@playwright/test";

test("スケジュール画面で期間を新規作成できる", async ({ page }) => {
  await page.goto("/schedule");

  // デフォルトで来月の日付が入っている前提。「期間を作成」を押す
  await page.getByRole("button", { name: "期間を作成" }).click();

  // 成功トーストが出ることを確認
  await expect(page.getByText("スケジュール期間を作成しました")).toBeVisible();
});
