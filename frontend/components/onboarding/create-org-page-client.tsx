"use client";

/**
 * 店舗作成ページのクライアント処理ラッパー
 *
 * /onboarding page.tsx がサーバーコンポーネントのまま metadata を export できるよう、
 * router.push() を使う onSuccess コールバックの定義をこのクライアントコンポーネントに委譲する。
 */
import { useRouter } from "next/navigation";
import { CreateOrgForm } from "@/components/onboarding/create-org-form";

export function CreateOrgPageClient() {
  const router = useRouter();

  function handleSuccess() {
    router.push("/onboarding/getting-started");
  }

  return <CreateOrgForm onSuccess={handleSuccess} />;
}
