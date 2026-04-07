import { vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  fetchFairnessDashboard: vi.fn(),
}));

// Re-export the mocked functions with correct types
import { apiFetch, fetchFairnessDashboard } from "@/lib/api";
export const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
export const mockFetchFairnessDashboard =
  fetchFairnessDashboard as ReturnType<typeof vi.fn>;
