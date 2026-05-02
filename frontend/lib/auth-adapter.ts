/**
 * 自前 HTTP Adapter for Auth.js v5
 *
 * Auth.js の公式 Adapter（Prisma 等）は使わず、FastAPI 内部 API を fetch で叩く。
 * これにより SQLAlchemy 側が唯一の DB 真実のままになり、スキーマ二重管理を避けられる。
 *
 * @see docs/plans/2026-04-30-phase0-1-auth-design.md §3.2
 */
import type {
  Adapter,
  AdapterUser,
  VerificationToken,
} from "@auth/core/adapters";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

function getInternalSecret(): string {
  const secret = process.env.INTERNAL_AUTH_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_AUTH_SECRET is not set");
  }
  return secret;
}

/** すべての内部 API リクエストに共通ヘッダーを付与して fetch する */
async function internalFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Auth-Secret": getInternalSecret(),
      ...options.headers,
    },
  });
}

/** バックエンドが返すユーザー形式を Auth.js AdapterUser に変換する */
function toAdapterUser(raw: {
  id: string;
  email: string;
  email_verified_at: string | null;
  name: string | null;
  image: string | null;
}): AdapterUser {
  return {
    id: raw.id,
    email: raw.email,
    emailVerified: raw.email_verified_at
      ? new Date(raw.email_verified_at)
      : null,
    name: raw.name ?? undefined,
    image: raw.image ?? undefined,
  };
}

/** バックエンドが返す VerificationToken を Auth.js 形式に変換する */
function toVerificationToken(raw: {
  identifier: string;
  token: string;
  expires: string;
}): VerificationToken {
  return {
    identifier: raw.identifier,
    token: raw.token,
    expires: new Date(raw.expires),
  };
}

export function createAuthAdapter(): Adapter {
  return {
    async createUser(user: AdapterUser): Promise<AdapterUser> {
      const res = await internalFetch("/api/internal/auth/users", {
        method: "POST",
        body: JSON.stringify({
          email: user.email,
          email_verified_at: user.emailVerified?.toISOString() ?? null,
          name: user.name ?? null,
          image: user.image ?? null,
        }),
      });
      if (!res.ok) {
        throw new Error(`createUser failed: ${res.status}`);
      }
      const raw = await res.json();
      return toAdapterUser(raw);
    },

    async getUser(id: string): Promise<AdapterUser | null> {
      const res = await internalFetch(`/api/internal/auth/users/${id}`);
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`getUser failed: ${res.status}`);
      }
      const raw = await res.json();
      return toAdapterUser(raw);
    },

    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const params = new URLSearchParams({ email });
      const res = await internalFetch(
        `/api/internal/auth/users/by-email?${params}`,
      );
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`getUserByEmail failed: ${res.status}`);
      }
      const raw = await res.json();
      return toAdapterUser(raw);
    },

    async updateUser(
      user: Partial<AdapterUser> & Pick<AdapterUser, "id">,
    ): Promise<AdapterUser> {
      const body: Record<string, unknown> = {};
      if (user.email !== undefined) body.email = user.email;
      if (user.emailVerified !== undefined)
        body.email_verified_at = user.emailVerified?.toISOString() ?? null;
      if (user.name !== undefined) body.name = user.name ?? null;
      if (user.image !== undefined) body.image = user.image ?? null;

      const res = await internalFetch(`/api/internal/auth/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`updateUser failed: ${res.status}`);
      }
      const raw = await res.json();
      return toAdapterUser(raw);
    },

    async createVerificationToken(
      token: VerificationToken,
    ): Promise<VerificationToken | null | undefined> {
      const res = await internalFetch(
        "/api/internal/auth/verification-tokens",
        {
          method: "POST",
          body: JSON.stringify({
            identifier: token.identifier,
            token: token.token,
            expires: token.expires.toISOString(),
          }),
        },
      );
      if (!res.ok) {
        throw new Error(`createVerificationToken failed: ${res.status}`);
      }
      const raw = await res.json();
      return toVerificationToken(raw);
    },

    async useVerificationToken(params: {
      identifier: string;
      token: string;
    }): Promise<VerificationToken | null> {
      const res = await internalFetch(
        "/api/internal/auth/verification-tokens/use",
        {
          method: "POST",
          body: JSON.stringify(params),
        },
      );
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`useVerificationToken failed: ${res.status}`);
      }
      const raw = await res.json();
      return toVerificationToken(raw);
    },
  };
}
