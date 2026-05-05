import type { Metadata } from "next";
import { DeleteAccountForm } from "@/components/account/delete-account-form";

export const metadata: Metadata = {
  title: "アカウント削除 | シフトすけっと",
};

export default function AccountDeletePage() {
  return (
    <div className="container mx-auto max-w-2xl py-12">
      <DeleteAccountForm />
    </div>
  );
}
