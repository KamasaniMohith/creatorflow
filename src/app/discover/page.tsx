import { DiscoverPage } from "@/components/creators/DiscoverPage";
import { requireWorkspaceMembership } from "@/lib/supabase/auth";

export const instant = false;

export default async function Discover() {
  await requireWorkspaceMembership();
  return <DiscoverPage />;
}
