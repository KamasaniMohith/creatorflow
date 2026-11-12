import { Suspense } from "react";
import { OutreachPage } from "@/components/outreach/OutreachPage";
import { requireWorkspaceMembership } from "@/lib/supabase/auth";

export default function Outreach() {
  return (
    <Suspense fallback={<p role="status">Checking your workspace...</p>}>
      <AuthorizedOutreach />
    </Suspense>
  );
}

async function AuthorizedOutreach() {
  await requireWorkspaceMembership();
  return <OutreachPage />;
}
