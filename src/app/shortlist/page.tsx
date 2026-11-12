import { ShortlistPage } from "@/components/shortlist/ShortlistPage";
import { requireWorkspaceMembership } from "@/lib/supabase/auth";

export const instant = false;

export default async function Shortlist() {
  await requireWorkspaceMembership();
  return <ShortlistPage />;
}
