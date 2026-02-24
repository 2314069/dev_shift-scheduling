import { vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

// Re-export the mocked function with correct type
import { apiFetch } from "@/lib/api";
export const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
