import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockApiFetch } from "@/test/helpers/mock-api";
import { makeShiftSlot } from "@/test/helpers/fixtures";
import { ShiftSlotTable } from "@/components/shift-slot-table";

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe("ShiftSlotTable", () => {
  it("displays shift slot list", async () => {
    const slots = [
      makeShiftSlot({ id: 1, name: "早番", start_time: "09:00", end_time: "17:00" }),
      makeShiftSlot({ id: 2, name: "遅番", start_time: "13:00", end_time: "21:00" }),
    ];
    mockApiFetch.mockResolvedValueOnce(slots);

    render(<ShiftSlotTable />);

    await waitFor(() => {
      expect(screen.getByText("早番")).toBeInTheDocument();
    });
    expect(screen.getByText("遅番")).toBeInTheDocument();
    expect(screen.getByText("09:00")).toBeInTheDocument();
    expect(screen.getByText("21:00")).toBeInTheDocument();
  });

  it("opens add dialog and saves a new slot", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce([]); // initial fetch

    render(<ShiftSlotTable />);

    await waitFor(() => {
      expect(screen.getByText("追加")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "追加" }));
    expect(screen.getByText("シフト枠追加")).toBeInTheDocument();

    // Fill name
    const nameInput = screen.getByPlaceholderText("例: 早番");
    await user.type(nameInput, "夜勤");

    // Save
    mockApiFetch.mockResolvedValueOnce({ id: 1, name: "夜勤", start_time: "09:00", end_time: "17:00" });
    mockApiFetch.mockResolvedValueOnce([]); // re-fetch
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/shift-slots",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("opens edit dialog with pre-filled data", async () => {
    const user = userEvent.setup();
    const slot = makeShiftSlot({ id: 1, name: "早番", start_time: "09:00", end_time: "17:00" });
    mockApiFetch.mockResolvedValueOnce([slot]);

    render(<ShiftSlotTable />);

    await waitFor(() => {
      expect(screen.getByText("早番")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByText("シフト枠編集")).toBeInTheDocument();
    expect(screen.getByDisplayValue("早番")).toBeInTheDocument();
  });

  it("shows delete confirmation and executes delete", async () => {
    const user = userEvent.setup();
    const slot = makeShiftSlot({ id: 1, name: "早番" });
    mockApiFetch.mockResolvedValueOnce([slot]);

    render(<ShiftSlotTable />);

    await waitFor(() => {
      expect(screen.getByText("早番")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "削除" }));
    expect(screen.getByText("シフト枠の削除")).toBeInTheDocument();

    mockApiFetch.mockResolvedValueOnce(undefined); // DELETE
    mockApiFetch.mockResolvedValueOnce([]); // re-fetch
    await user.click(screen.getByRole("button", { name: "確認" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/shift-slots/1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("disables save when name is empty", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce([]);

    render(<ShiftSlotTable />);

    await waitFor(() => {
      expect(screen.getByText("追加")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "追加" }));

    // Clear the pre-filled name
    const nameInput = screen.getByPlaceholderText("例: 早番");
    await user.clear(nameInput);

    const saveBtn = screen.getByRole("button", { name: "保存" });
    expect(saveBtn).toBeDisabled();
  });
});
