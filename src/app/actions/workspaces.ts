"use server";

import { createClient } from "@/lib/supabase/server";

export async function createWorkspace(input: {
  name: string;
  slug: string;
}): Promise<{ id: string }> {
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();

  if (name.length < 2 || name.length > 100) {
    throw new Error("Workspace name must be between 2 and 100 characters.");
  }
  if (
    slug.length < 3 ||
    slug.length > 63 ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
  ) {
    throw new Error("Workspace slug must use 3-63 lowercase letters, digits, or single hyphens.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Sign in again before creating a workspace.");
  }

  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: name,
    p_slug: slug,
  });
  if (error) {
    console.error("Workspace creation failed.", error);
    if (error.code === "23505") {
      throw new Error("That workspace slug is already in use.");
    }
    throw new Error("Workspace creation failed. Please try again.");
  }
  if (typeof data !== "string") {
    throw new Error("Workspace creation returned an invalid result.");
  }

  return { id: data };
}
