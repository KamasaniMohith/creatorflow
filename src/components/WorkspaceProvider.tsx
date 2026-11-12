"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

interface WorkspaceContextValue {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  loading: boolean;
  error: string | null;
  selectWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const ACTIVE_WORKSPACE_KEY = "creatorflow_active_workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: membershipRows, error: membershipError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id);
      if (membershipError) throw membershipError;

      const memberships = (membershipRows ?? []) as Array<{
        workspace_id: string;
        role: WorkspaceRole;
      }>;
      if (memberships.length === 0) {
        setWorkspaces([]);
        setActiveWorkspaceId(null);
        setLoading(false);
        return;
      }

      const workspaceIds = memberships.map((membership) => membership.workspace_id);
      const { data: workspaceRows, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id, name, slug")
        .in("id", workspaceIds);
      if (workspaceError) throw workspaceError;

      const roleByWorkspace = new Map(
        memberships.map((membership) => [membership.workspace_id, membership.role]),
      );
      const available = ((workspaceRows ?? []) as Array<{
        id: string;
        name: string;
        slug: string;
      }>).flatMap((workspace) => {
        const role = roleByWorkspace.get(workspace.id);
        return role
          ? [{ ...workspace, role }]
          : [];
      });

      if (available.length !== memberships.length) {
        throw new Error("One or more workspace memberships could not be resolved.");
      }

      setWorkspaces(available);
      const storedId = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
      const nextId =
        storedId && available.some((workspace) => workspace.id === storedId)
        ? storedId
        : available[0].id;
      setActiveWorkspaceId(nextId);
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, nextId);
    } catch (loadError) {
      console.error("Unable to load workspace memberships.", loadError);
      setError("Your workspaces could not be loaded. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void Promise.resolve().then(refreshWorkspaces);
  }, [refreshWorkspaces]);

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      if (!workspaces.some((workspace) => workspace.id === workspaceId)) {
        setError("You do not have access to that workspace.");
        return;
      }
      setError(null);
      setActiveWorkspaceId(workspaceId);
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    },
    [workspaces],
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      loading,
      error,
      selectWorkspace,
      refreshWorkspaces,
    }),
    [activeWorkspace, error, loading, refreshWorkspaces, selectWorkspace, workspaces],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider.");
  return context;
}
