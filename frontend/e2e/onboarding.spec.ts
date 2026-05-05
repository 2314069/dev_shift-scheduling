/**
 * オンボーディングフロー E2E テスト
 *
 * 重要: 本 spec は BYPASS_AUTH_FOR_E2E を使用しない。
 * 通常の Magic Link ログインフロー（Mailpit 経由）でテストする。
 *
 * 前提条件:
 * - バックエンドは BYPASS_AUTH_FOR_E2E 未設定で起動
 * - フロントエンドは E2E_DISABLE_AUTH 未設定で起動
 * - Mailpit が http://127.0.0.1:8025 で起動していること
 *
 * NOTE: 本 spec は環境固有の制約（Mailpit 起動、バイパス無効化設定）が必要なため、
 * 既存 E2E 3 件（バイパス使用）とは別コンテキストで実行することを想定している。
 * 既存テストを破壊せず追加されるオプション spec として位置付ける。
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §6, §7
 */
import { test, expect } from "@playwright/test";

const MAILPIT_URL = "http://127.0.0.1:8025";
const TEST_EMAIL = `onboarding-e2e-${Date.now()}@shift-suketto.local`;

/**
 * Mailpit REST API からメールを取得し、Magic Link URL を抽出する。
 *
 * Mailpit の REST API:
 *   GET /api/v1/messages — メッセージ一覧（最新順）
 *   GET /api/v1/message/{id} — メッセージ詳細（HTML/Text Body）
 *
 * Magic Link は Auth.js Nodemailer provider が送信する。
 * URL パターン: <a href="http://...?token=...&callbackUrl=...">
 */
async function getMagicLinkFromMailpit(toEmail: string): Promise<string> {
  // メッセージ一覧を取得（最大 10 件、最新順）
  const listRes = await fetch(`${MAILPIT_URL}/api/v1/messages`);
  if (!listRes.ok) {
    throw new Error(
      `Mailpit API error: ${listRes.status} — Mailpit が http://127.0.0.1:8025 で起動しているか確認してください`,
    );
  }
  const list = await listRes.json();
  const messages: Array<{ ID: string; To: Array<{ Address: string }> }> =
    list.messages ?? [];

  // 対象メールアドレス宛のメッセージを探す
  const target = messages.find((m) => m.To.some((t) => t.Address === toEmail));
  if (!target) {
    throw new Error(
      `Mailpit に ${toEmail} 宛のメッセージが見つかりません。Magic Link メールが送信されたか確認してください。`,
    );
  }

  // メッセージ詳細を取得
  const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${target.ID}`);
  const msg = await msgRes.json();

  // HTML ボディから Magic Link を抽出
  const html: string = msg.HTML ?? msg.Text ?? "";
  const match = html.match(/href="(http[^"]+api\/auth\/callback[^"]+)"/);
  if (!match) {
    throw new Error(
      "Magic Link URL が見つかりません。Auth.js のメールテンプレートを確認してください。",
    );
  }

  return match[1].replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// シナリオ 1: 新規ユーザーがサインインしてオンボーディングを完了する
// ---------------------------------------------------------------------------

test.describe("新規ユーザーのオンボーディングフロー", () => {
  test.skip(
    process.env.BYPASS_AUTH_FOR_E2E === "1",
    "バイパスモードでは通常ログインフローのテストをスキップする",
  );

  test("サインイン → /onboarding へリダイレクト → 店舗名入力 → /onboarding/getting-started 遷移", async ({
    page,
  }) => {
    // Step 1: サインイン画面を開く
    await page.goto("/signin");
    await expect(page).toHaveURL(/signin/);

    // Step 2: メールアドレスを入力して Magic Link を送信
    await page.getByLabel(/email|メール/i).fill(TEST_EMAIL);
    await page
      .getByRole("button", { name: /sign in|サインイン|送信/i })
      .click();

    // Step 3: 「メールを確認してください」画面へ遷移
    await expect(page).toHaveURL(/verify-request/);

    // Step 4: Mailpit から Magic Link を取得してクリック
    // Nodemailer がメールを送るまで少し待機
    await page.waitForTimeout(2000);
    const magicLink = await getMagicLinkFromMailpit(TEST_EMAIL);

    // Step 5: Magic Link を直接 navigate（クリックと同等）
    await page.goto(magicLink);

    // Step 6: 組織未所属なので /onboarding へリダイレクトされること
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 10000 });

    // Step 7: 「店舗名」入力欄が表示されること
    await expect(
      page.getByLabel(/店舗名|組織名/i).or(page.getByPlaceholder(/店舗名|例:/)),
    ).toBeVisible();

    // Step 8: 店舗名を入力して送信
    const storeName = `E2E テスト食堂 ${Date.now()}`;
    await page
      .getByLabel(/店舗名|組織名/i)
      .or(page.getByPlaceholder(/店舗名|例:/))
      .fill(storeName);
    await page.getByRole("button", { name: /作成|登録|次へ|続ける/i }).click();

    // Step 9: /onboarding/getting-started へ遷移すること
    await expect(page).toHaveURL(/\/onboarding\/getting-started/, {
      timeout: 10000,
    });

    // Step 10: チェックリストが表示されること
    // スタッフ登録・シフト枠登録のステップが見えること
    await expect(
      page
        .getByText(/スタッフ/)
        .or(page.getByText(/シフト枠/))
        .first(),
    ).toBeVisible();
  });

  test("チェックリストでスタッフ登録後にチェックが点灯する", async ({
    page,
  }) => {
    // 本テストは上記テストの続きとして実行するか、
    // 独立して実行する場合はサインイン + 組織作成を再度行う必要がある。
    // Phase 1-1 では基本フローの確認のみ行い、詳細は Worker B の単体テストに委ねる。
    test.skip(true, "チェックリスト点灯テストは Phase 1-2 以降に実装予定");
  });
});

// ---------------------------------------------------------------------------
// シナリオ 2: 既存ユーザー（組織所属済み）は /onboarding を経由しない
// ---------------------------------------------------------------------------

test.describe("既存ユーザーのルーティング確認", () => {
  test.skip(
    process.env.BYPASS_AUTH_FOR_E2E === "1",
    "バイパスモードでは通常ルーティングテストをスキップする",
  );

  test("組織所属済みユーザーがルートにアクセスすると /schedule にリダイレクトされる", async ({
    page,
  }) => {
    // NOTE: このテストは既存の組織所属済みユーザーでサインインする必要がある。
    // Phase 1-1 E2E では Mailpit + 新規ユーザーフローのみ検証し、
    // 既存ユーザーの再サインインは Phase 1-2 以降で詳細テストを追加する。
    test.skip(true, "既存ユーザーの再サインインフローは Phase 1-2 で実装");
  });
});
