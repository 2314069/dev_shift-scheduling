import { defineConfig, devices } from "@playwright/test";

// E2E テスト用 SQLite は backend ディレクトリに置き、各実行前に globalSetup で削除する
const E2E_DB_FILENAME = "e2e_test.db";
// ユーザーの dev server (3000/8000) と衝突させないため、E2E 専用ポートを使用
// localhost は macOS で IPv6/IPv4 の揺れが出るため 127.0.0.1 で統一
const BACKEND_URL = "http://127.0.0.1:8100";
const FRONTEND_URL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  globalSetup: "./e2e/global-setup.ts",
  webServer: [
    {
      // backend 起動前に test DB を削除する（globalSetup は webServer 起動後に走るため不適）
      command: `rm -f ./${E2E_DB_FILENAME} && exec uv run uvicorn backend.main:app --host 127.0.0.1 --port 8100`,
      cwd: "../backend",
      env: {
        DATABASE_URL: `sqlite:///./${E2E_DB_FILENAME}`,
        ALLOWED_ORIGINS: FRONTEND_URL,
        // E2E 時は認証を無効化して固定ユーザーを返す。APP_ENV != "production" の安全弁と組み合わせることで本番では絶対に有効化されない
        BYPASS_AUTH_FOR_E2E: "1",
      },
      url: `${BACKEND_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `NEXT_PUBLIC_API_URL='${BACKEND_URL}' E2E_DISABLE_AUTH=1 npm run dev -- --port 3100 --hostname 127.0.0.1`,
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
