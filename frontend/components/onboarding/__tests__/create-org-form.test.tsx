/**
 * CreateOrgForm の単体テスト
 *
 * テスト対象:
 *   - 初期表示: 入力欄・ボタン・ヒント文言の表示
 *   - 空入力で送信: インラインエラー「店舗名を入力してください」表示、API未呼び出し
 *   - 100文字超で送信: インラインエラー「店舗名は100文字以内で入力してください」表示、API未呼び出し
 *   - 成功 (201): onSuccess が呼ばれる
 *   - 409「既所有」: onSuccess が呼ばれる（getting-started へのリダイレクトと同等の扱い）
 *   - 409「slug衝突」: Alert に「もう一度お試しください」表示、onSuccess は呼ばれない
 *   - 422: Alert に「入力内容を確認してください」表示
 *   - ネットワークエラー / 5xx: Alert に通信エラーメッセージ表示
 *   - 送信中: ボタン disabled + Loader2 表示、Input disabled
 *
 * @see docs/plans/2026-05-05-phase1-1-onboarding-ui-design.md §4.1
 * @see docs/plans/2026-05-05-phase1-1-onboarding-design.md §7.1
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateOrgForm } from "@/components/onboarding/create-org-form";
import { ApiError } from "@/lib/api";

// next-auth/react の signOut をモック
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

// lib/api の createOrganization をモック
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createOrganization: vi.fn(),
  };
});

import { createOrganization } from "@/lib/api";
const mockCreateOrganization = vi.mocked(createOrganization);

// テスト用の OrganizationResponse フィクスチャ
const mockOrganizationResponse = {
  id: "org-1",
  name: "テスト店舗",
  slug: "abc123def456",
  created_at: "2026-05-05T10:00:00",
  updated_at: "2026-05-05T10:00:00",
  deleted_at: null,
};

describe("CreateOrgForm", () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    mockOnSuccess.mockReset();
    mockCreateOrganization.mockReset();
  });

  describe("初期表示", () => {
    it("店舗名ラベル・入力欄・送信ボタンが表示される", () => {
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      expect(screen.getByLabelText("店舗名")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      ).toBeInTheDocument();
    });

    it("プレースホルダーとヒント文言が表示される", () => {
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      expect(
        screen.getByPlaceholderText("例: 渋谷カフェ 本店"),
      ).toBeInTheDocument();
      expect(screen.getByText("あとから変更できます")).toBeInTheDocument();
    });

    it("サービス名とキャッチコピーが表示される", () => {
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      expect(screen.getByText("シフトすけっと")).toBeInTheDocument();
      expect(
        screen.getByText("スタッフのシフトを、かんたんに作成できます。"),
      ).toBeInTheDocument();
    });

    it("カードのタイトルとサブタイトルが表示される", () => {
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      expect(screen.getByText("お店を登録しましょう")).toBeInTheDocument();
      expect(
        screen.getByText("店舗名を入力すると、シフト管理を始められます。"),
      ).toBeInTheDocument();
    });
  });

  describe("バリデーション（クライアントサイド）", () => {
    it("空文字で送信するとインラインエラー「店舗名を入力してください」が表示される", async () => {
      const user = userEvent.setup();
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      expect(
        await screen.findByText("店舗名を入力してください"),
      ).toBeInTheDocument();
      expect(mockCreateOrganization).not.toHaveBeenCalled();
    });

    it("空白のみの入力で送信するとインラインエラーが表示される", async () => {
      const user = userEvent.setup();
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText("店舗名"), "   ");
      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      expect(
        await screen.findByText("店舗名を入力してください"),
      ).toBeInTheDocument();
      expect(mockCreateOrganization).not.toHaveBeenCalled();
    });

    it("101文字の入力で送信するとインラインエラー「店舗名は100文字以内で入力してください」が表示される", async () => {
      const user = userEvent.setup();
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      // Input に maxLength={100} があるため直接 value を設定してバリデーションをテスト
      const input = screen.getByLabelText("店舗名");
      // fireEvent を使って maxLength を超える文字を直接設定する
      // userEvent.type は maxLength を尊重するため、onChange イベントを直接発火する
      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(input, { target: { value: "あ".repeat(101) } });

      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      expect(
        await screen.findByText("店舗名は100文字以内で入力してください"),
      ).toBeInTheDocument();
      expect(mockCreateOrganization).not.toHaveBeenCalled();
    });

    it("100文字以内の入力では API が呼ばれる", async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockResolvedValueOnce(mockOrganizationResponse);
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText("店舗名"), "テスト店舗");
      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      await waitFor(() => {
        expect(mockCreateOrganization).toHaveBeenCalledWith({
          name: "テスト店舗",
        });
      });
    });
  });

  describe("API 呼び出しと結果処理", () => {
    it("成功（201）時に onSuccess が呼ばれる", async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockResolvedValueOnce(mockOrganizationResponse);
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText("店舗名"), "テスト店舗");
      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it("名前の前後の空白が trim されて送信される", async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockResolvedValueOnce(mockOrganizationResponse);
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText("店舗名"), "  テスト店舗  ");
      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      await waitFor(() => {
        expect(mockCreateOrganization).toHaveBeenCalledWith({
          name: "テスト店舗",
        });
      });
    });

    it("409「You already own an organization」時に onSuccess が呼ばれる（既所有 = getting-started へ）", async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockRejectedValueOnce(
        new ApiError(409, "You already own an organization"),
      );
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText("店舗名"), "テスト店舗");
      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it("409「Organization slug conflict」時に Alert「もう一度お試しください」が表示される", async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockRejectedValueOnce(
        new ApiError(409, "Organization slug conflict, please retry"),
      );
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText("店舗名"), "テスト店舗");
      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      expect(
        await screen.findByText("もう一度お試しください"),
      ).toBeInTheDocument();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it("422 時に Alert「入力内容を確認してください」が表示される", async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockRejectedValueOnce(
        new ApiError(422, "Validation error"),
      );
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText("店舗名"), "テスト店舗");
      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      expect(
        await screen.findByText("入力内容を確認してください"),
      ).toBeInTheDocument();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it("ネットワークエラー時に Alert「通信エラーが発生しました...」が表示される", async () => {
      const user = userEvent.setup();
      mockCreateOrganization.mockRejectedValueOnce(new Error("Network error"));
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      await user.type(screen.getByLabelText("店舗名"), "テスト店舗");
      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      expect(
        await screen.findByText(
          "通信エラーが発生しました。しばらくしてから再試行してください",
        ),
      ).toBeInTheDocument();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  describe("送信中の状態（isPending）", () => {
    it("送信中はボタンが disabled になり「登録中...」と表示される", async () => {
      const user = userEvent.setup();
      // resolve を手動でコントロールするために Promise を保留状態にする
      let resolveCreate!: (value: typeof mockOrganizationResponse) => void;
      const pendingPromise = new Promise<typeof mockOrganizationResponse>(
        (resolve) => {
          resolveCreate = resolve;
        },
      );
      mockCreateOrganization.mockReturnValueOnce(pendingPromise);

      render(<CreateOrgForm onSuccess={mockOnSuccess} />);
      await user.type(screen.getByLabelText("店舗名"), "テスト店舗");
      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      // 送信中の状態を確認
      await waitFor(() => {
        expect(screen.getByText("登録中...")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /登録中/ })).toBeDisabled();
      });

      // クリーンアップのため resolve する
      resolveCreate(mockOrganizationResponse);
    });

    it("送信中は Input が disabled になる", async () => {
      const user = userEvent.setup();
      let resolveCreate!: (value: typeof mockOrganizationResponse) => void;
      const pendingPromise = new Promise<typeof mockOrganizationResponse>(
        (resolve) => {
          resolveCreate = resolve;
        },
      );
      mockCreateOrganization.mockReturnValueOnce(pendingPromise);

      render(<CreateOrgForm onSuccess={mockOnSuccess} />);
      await user.type(screen.getByLabelText("店舗名"), "テスト店舗");
      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      await waitFor(() => {
        expect(screen.getByLabelText("店舗名")).toBeDisabled();
      });

      resolveCreate(mockOrganizationResponse);
    });
  });

  describe("アクセシビリティ", () => {
    it("バリデーションエラー時に Input に aria-invalid が設定される", async () => {
      const user = userEvent.setup();
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);

      await user.click(
        screen.getByRole("button", { name: "お店を登録して始める" }),
      );

      const input = screen.getByLabelText("店舗名");
      await waitFor(() => {
        expect(input).toHaveAttribute("aria-invalid", "true");
      });
    });

    it("エラーがない場合は aria-invalid が false（文字列）である", () => {
      render(<CreateOrgForm onSuccess={mockOnSuccess} />);
      const input = screen.getByLabelText("店舗名");
      expect(input).toHaveAttribute("aria-invalid", "false");
    });
  });
});
