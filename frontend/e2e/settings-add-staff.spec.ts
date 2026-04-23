import { test, expect } from "@playwright/test";

test("設定画面でスタッフを新規追加できる", async ({ page }) => {
  await page.goto("/settings");

  // 空状態 -> 「最初のスタッフを追加」ボタンをクリック
  await page.getByRole("button", { name: "最初のスタッフを追加" }).click();

  // フォーム入力
  await page.getByPlaceholder("例: 山田太郎").fill("E2E テスト太郎");
  await page.getByPlaceholder("例: 正社員").fill("正社員");

  // 保存
  await page.getByRole("button", { name: "保存" }).click();

  // 追加されたスタッフがテーブルに表示されることを確認
  await expect(
    page.getByRole("cell", { name: "E2E テスト太郎" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "正社員" })).toBeVisible();
});
