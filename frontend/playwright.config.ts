import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// E2E テスト用 SQLite は backend ディレクトリに置き、各実行前に globalSetup で削除する
const E2E_DB_FILENAME = "e2e_test.db";
// ユーザーの dev server (3000/8000) と衝突させないため、E2E 専用ポートを使用
// localhost は macOS で IPv6/IPv4 の揺れが出るため 127.0.0.1 で統一
const BACKEND_URL = "http://127.0.0.1:8100";
const FRONTEND_URL = "http://127.0.0.1:3100";
const E2E_AUTH_SECRET = "e2e-auth-secret-at-least-32-characters";
const E2E_INTERNAL_AUTH_SECRET = "e2e-internal-auth-secret";

process.env.BYPASS_AUTH_FOR_E2E ??= "1";

const WINGET_UV_PATH = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Microsoft",
  "WinGet",
  "Packages",
  "astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe",
  "uv.exe",
);
const UV_COMMAND =
  process.env.UV_BIN ??
  (process.platform === "win32" && fs.existsSync(WINGET_UV_PATH)
    ? `"${WINGET_UV_PATH}"`
    : "uv");
const DELETE_E2E_DB_COMMAND = `node -e "const fs=require('fs');try{fs.unlinkSync('./${E2E_DB_FILENAME}')}catch(e){if(e.code!=='ENOENT')throw e}"`;

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
      command: `${DELETE_E2E_DB_COMMAND} && ${UV_COMMAND} run uvicorn backend.main:app --host 127.0.0.1 --port 8100`,
      cwd: "../backend",
      env: {
        DATABASE_URL: `sqlite:///./${E2E_DB_FILENAME}`,
        ALLOWED_ORIGINS: FRONTEND_URL,
        // E2E 時は認証を無効化して固定ユーザーを返す。APP_ENV を "test" に明示することでのみ
        // バイパスが有効化される fail-close 方式（本番では APP_ENV を未設定 or "production" にする）
        APP_ENV: "test",
        BYPASS_AUTH_FOR_E2E: "1",
        AUTH_SECRET: E2E_AUTH_SECRET,
        INTERNAL_AUTH_SECRET: E2E_INTERNAL_AUTH_SECRET,
      },
      url: `${BACKEND_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm run dev -- --port 3100 --hostname 127.0.0.1",
      env: {
        NEXT_PUBLIC_API_URL: BACKEND_URL,
        BACKEND_INTERNAL_URL: BACKEND_URL,
        E2E_DISABLE_AUTH: "1",
        AUTH_SECRET: E2E_AUTH_SECRET,
        INTERNAL_AUTH_SECRET: E2E_INTERNAL_AUTH_SECRET,
        NEXTAUTH_URL: FRONTEND_URL,
      },
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
