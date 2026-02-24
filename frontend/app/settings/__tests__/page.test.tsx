import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { mockApiFetch } from "@/test/helpers/mock-api";
import SettingsPage from "@/app/settings/page";

beforeEach(() => {
  mockApiFetch.mockReset();
  // Each of the 3 sub-components fetches its own data
  // StaffTable: /api/staff
  // ShiftSlotTable: /api/shift-slots
  // StaffingRequirementsTable: /api/staffing-requirements + /api/shift-slots
  mockApiFetch.mockResolvedValue([]);
});

describe("SettingsPage", () => {
  it("renders all three management sections", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("スタッフ管理")).toBeInTheDocument();
    });
    expect(screen.getByText("シフト枠管理")).toBeInTheDocument();
    expect(screen.getByText("必要人数設定")).toBeInTheDocument();
  });

  it("displays page title", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("設定")).toBeInTheDocument();
    });
  });
});
