import { CampaignsPage } from "@/components/campaigns/CampaignsPage";
import { requireWorkspaceMembership } from "@/lib/supabase/auth";

export const instant = false;

export default async function Campaigns() {
  await requireWorkspaceMembership();
  return <CampaignsPage />;
}
