import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch } from "@/lib/api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("apiFetch", () => {
  it("calls fetch with correct URL and Content-Type header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
    });

    await apiFetch("/api/staff");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/staff",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(apiFetch("/api/missing")).rejects.toThrow("API error: 404");
  });

  it("returns undefined for 204 No Content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await apiFetch("/api/staff/1");
    expect(result).toBeUndefined();
  });

  it("parses JSON response", async () => {
    const data = [{ id: 1, name: "テスト" }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    });

    const result = await apiFetch("/api/staff");
    expect(result).toEqual(data);
  });

  it("forwards request options", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await apiFetch("/api/staff", {
      method: "POST",
      body: JSON.stringify({ name: "新規" }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/staff",
      expect.objectContaining({
        method: "POST",
        body: '{"name":"新規"}',
      })
    );
  });
});
