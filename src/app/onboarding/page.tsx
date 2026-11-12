import { Suspense } from "react";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { WorkspaceOnboarding } from "@/components/workspaces/WorkspaceOnboarding";
import { redirect } from "next/navigation";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-12">
          <p role="status">Checking your account...</p>
        </main>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

async function OnboardingContent() {
  const { user, supabase } = await requireAuthenticatedUser();
  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1);
  if (error) throw new Error("Unable to check existing workspace membership.");
  if (memberships?.length) redirect("/");

  return (
    <WorkspaceOnboarding
      displayName={
        typeof user.user_metadata.display_name === "string"
          ? user.user_metadata.display_name
          : ""
      }
    />
  );
}
