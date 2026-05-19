/**
 * StaffOnboardingHint の単体テスト
 *
 * テスト対象:
 *   - スタッフ名と案内文の表示
 *   - dismiss クリックで非表示
 *   - dismiss すると localStorage に "1" が書かれる
 *   - 既存 localStorage で最初から非表示
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffOnboardingHint } from "@/components/onboarding/staff-onboarding-hint";

describe("StaffOnboardingHint", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("スタッフ名と「ようこそ」が表示される", () => {
    render(
      <StaffOnboardingHint staffName="山田太郎" storageKey="staff-intro:1" />,
    );

    expect(screen.getByText(/ようこそ、山田太郎/)).toBeInTheDocument();
    expect(
      screen.getByText("ここはあなたのシフト希望を提出するページです。"),
    ).toBeInTheDocument();
  });

  it("案内文に「希望シフト」「出勤不可」が含まれる", () => {
    render(<StaffOnboardingHint staffName="花子" storageKey="staff-intro:2" />);
    expect(screen.getByText(/希望シフト.*出勤不可/)).toBeInTheDocument();
  });

  it("dismiss クリックで非表示になる", async () => {
    const user = userEvent.setup();
    render(<StaffOnboardingHint staffName="太郎" storageKey="staff-intro:3" />);

    await user.click(
      screen.getByRole("button", { name: "このお知らせを閉じる" }),
    );

    expect(screen.queryByText(/ようこそ、太郎/)).not.toBeInTheDocument();
  });

  it("dismiss すると localStorage に「1」が書かれる", async () => {
    const user = userEvent.setup();
    render(<StaffOnboardingHint staffName="次郎" storageKey="staff-intro:4" />);

    await user.click(
      screen.getByRole("button", { name: "このお知らせを閉じる" }),
    );

    expect(window.localStorage.getItem("staff-intro:4")).toBe("1");
  });

  it("localStorage に既存の dismiss 記録があれば最初から非表示", () => {
    window.localStorage.setItem("staff-intro:5", "1");
    render(<StaffOnboardingHint staffName="三郎" storageKey="staff-intro:5" />);

    expect(screen.queryByText(/ようこそ、三郎/)).not.toBeInTheDocument();
  });
});
