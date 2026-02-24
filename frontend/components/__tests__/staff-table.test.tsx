import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockApiFetch } from "@/test/helpers/mock-api";
import { makeStaff } from "@/test/helpers/fixtures";
import { StaffTable } from "@/components/staff-table";

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe("StaffTable", () => {
  it("shows loading state initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<StaffTable />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("displays staff list after loading", async () => {
    const staffList = [
      makeStaff({ id: 1, name: "山田太郎", role: "正社員", max_days_per_week: 5 }),
      makeStaff({ id: 2, name: "佐藤花子", role: "パート", max_days_per_week: 3 }),
    ];
    mockApiFetch.mockResolvedValueOnce(staffList);

    render(<StaffTable />);

    await waitFor(() => {
      expect(screen.getByText("山田太郎")).toBeInTheDocument();
    });
    expect(screen.getByText("佐藤花子")).toBeInTheDocument();
    expect(screen.getByText("正社員")).toBeInTheDocument();
    expect(screen.getByText("パート")).toBeInTheDocument();
  });

  it("opens add dialog, fills form, and saves", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce([]); // initial fetch

    render(<StaffTable />);

    await waitFor(() => {
      expect(screen.getByText("追加")).toBeInTheDocument();
    });

    // Open add dialog
    await user.click(screen.getByRole("button", { name: "追加" }));
    expect(screen.getByText("スタッフ追加")).toBeInTheDocument();

    // Fill form
    const nameInput = screen.getByPlaceholderText("例: 山田太郎");
    await user.type(nameInput, "新規スタッフ");

    // Save
    mockApiFetch.mockResolvedValueOnce({ id: 1, name: "新規スタッフ", role: "", max_days_per_week: 5 });
    mockApiFetch.mockResolvedValueOnce([]); // re-fetch
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/staff",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("opens edit dialog with pre-filled data", async () => {
    const user = userEvent.setup();
    const staff = makeStaff({ id: 1, name: "山田太郎", role: "正社員", max_days_per_week: 5 });
    mockApiFetch.mockResolvedValueOnce([staff]);

    render(<StaffTable />);

    await waitFor(() => {
      expect(screen.getByText("山田太郎")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByText("スタッフ編集")).toBeInTheDocument();
    expect(screen.getByDisplayValue("山田太郎")).toBeInTheDocument();
  });

  it("shows delete confirmation and executes delete", async () => {
    const user = userEvent.setup();
    const staff = makeStaff({ id: 1, name: "山田太郎" });
    mockApiFetch.mockResolvedValueOnce([staff]);

    render(<StaffTable />);

    await waitFor(() => {
      expect(screen.getByText("山田太郎")).toBeInTheDocument();
    });

    // Click delete button
    await user.click(screen.getByRole("button", { name: "削除" }));

    // Confirm dialog should appear
    expect(screen.getByText("スタッフの削除")).toBeInTheDocument();

    // Confirm
    mockApiFetch.mockResolvedValueOnce(undefined); // DELETE
    mockApiFetch.mockResolvedValueOnce([]); // re-fetch
    await user.click(screen.getByRole("button", { name: "確認" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/staff/1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("disables save button when name is empty", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce([]);

    render(<StaffTable />);

    await waitFor(() => {
      expect(screen.getByText("追加")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "追加" }));

    // Name is empty by default, save button should be disabled
    const saveBtn = screen.getByRole("button", { name: "保存" });
    expect(saveBtn).toBeDisabled();
  });
});
