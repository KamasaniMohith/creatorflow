import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { requireWorkspaceMembership } from "@/lib/supabase/auth";

export const instant = false;

export default async function Home() {
  await requireWorkspaceMembership();
  return <DashboardPage />;
}
