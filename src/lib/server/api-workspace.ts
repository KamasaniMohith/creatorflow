import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceRole } from "@/components/WorkspaceProvider";

export type ApiWorkspaceResult =
  | {
      ok: true;
      userId: string;
      workspaceId: string;
      role: WorkspaceRole;
      supabase: SupabaseClient;
    }
  | { ok: false; status: 400 | 401 | 403 | 500; error: string };

export async function authorizeApiWorkspace(
  workspaceId: unknown,
  allowedRoles: WorkspaceRole[] = ["owner", "admin", "member"],
): Promise<ApiWorkspaceResult> {
  if (
    typeof workspaceId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      workspaceId,
    )
  ) {
    return { ok: false, status: 400, error: "A valid workspace is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error("API workspace session validation failed.", authError);
    return { ok: false, status: 401, error: "Your session could not be validated." };
  }
  if (!user) return { ok: false, status: 401, error: "Sign in to continue." };

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) {
    console.error("API workspace membership validation failed.", membershipError);
    return { ok: false, status: 500, error: "Workspace access could not be verified." };
  }
  if (!membership) {
    return { ok: false, status: 403, error: "You do not have access to this workspace." };
  }

  const role = membership.role as WorkspaceRole;
  if (!allowedRoles.includes(role)) {
    return { ok: false, status: 403, error: "Your workspace role cannot perform this action." };
  }

  return { ok: true, userId: user.id, workspaceId, role, supabase };
}
