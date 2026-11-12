import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isMissingOrExpiredSession(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const authError = error as { name?: unknown; status?: unknown; code?: unknown };
  return (
    authError.name === "AuthSessionMissingError" ||
    authError.status === 401 ||
    authError.code === "bad_jwt" ||
    authError.code === "session_not_found" ||
    authError.code === "session_expired" ||
    authError.code === "refresh_token_not_found" ||
    authError.code === "refresh_token_already_used"
  );
}

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (isMissingOrExpiredSession(error)) redirect("/login");
  if (error) throw new Error("Unable to validate the current Supabase session.");
  if (!data.user) redirect("/login");

  return { supabase, user: data.user };
}

export async function requireWorkspaceMembership() {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1);

  if (error) throw new Error("Unable to validate workspace membership.");
  if (!data?.length) redirect("/onboarding");
  return { supabase, user };
}
