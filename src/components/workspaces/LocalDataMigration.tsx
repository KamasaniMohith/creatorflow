"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { useAppData } from "@/components/AppProvider";
import {
  importLocalWorkspaceData,
  type LocalMigrationResult,
} from "@/lib/supabase/workspace-data";
import { storage } from "@/lib/storage";

export function LocalDataMigration() {
  const { user } = useAuth();
  const { activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const { reloadWorkspaceData } = useAppData();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [importing, setImporting] = useState(false);
  const [localData, setLocalData] = useState<ReturnType<
    typeof storage.loadMigrationData
  > | null>(null);
  const [result, setResult] = useState<LocalMigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve().then(() => setAvailable(storage.hasLocalData()));
  }, []);

  const importCounts = useMemo(() => {
    if (!localData) return null;
    const referencedCreatorIds = new Set([
      ...localData.shortlist,
      ...localData.campaigns.flatMap((campaign) => campaign.creatorIds),
      ...localData.outreach.map((record) => record.creatorId),
    ]);
    return {
      creators: localData.creators.filter(
        (creator) =>
          creator.dataSource === "User Entry" ||
          referencedCreatorIds.has(creator.id),
      ).length,
      campaigns: localData.campaigns.length,
      shortlist: localData.shortlist.length,
      outreach: localData.outreach.length,
      templates: localData.templates.length,
    };
  }, [localData]);

  if (!available || workspaceLoading || !activeWorkspace || !user) return null;

  function openMigration() {
    setLocalData(storage.loadMigrationData());
    setResult(null);
    setError(null);
    setBackedUp(false);
    setOpen(true);
  }

  function downloadBackup() {
    try {
      const backup = storage.createRawBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `creatorflow-local-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setBackedUp(true);
      setError(null);
    } catch (backupError) {
      console.error("Unable to export the local CreatorFlow backup.", backupError);
      setError("The local backup could not be downloaded. Try again before importing.");
    }
  }

  async function importData() {
    if (!localData || !backedUp) return;
    setImporting(true);
    setError(null);
    try {
      const importResult = await importLocalWorkspaceData(
        activeWorkspace!.id,
        user!.id,
        activeWorkspace!.role,
        localData,
      );
      setResult(importResult);
      await reloadWorkspaceData();
      setAvailable(storage.hasLocalData());
    } catch (importError) {
      console.error("Local CreatorFlow data import failed.", importError);
      setError(
        importError instanceof Error
          ? `Import stopped safely: ${importError.message}. Existing local data remains unchanged; retrying will skip records already imported.`
          : "Import stopped safely. Existing local data remains unchanged; retrying will skip records already imported.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <div>
          <strong>Local CreatorFlow data is still on this device.</strong>
          <p className="mt-1">Back it up and explicitly import it into {activeWorkspace.name}.</p>
        </div>
        <button className="button button-secondary" onClick={openMigration}>
          <Upload size={15} /> Review local data
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            aria-labelledby="local-migration-title"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="local-migration-title" className="text-xl font-semibold">
                  Import local workspace data
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Destination: {activeWorkspace.name}. LocalStorage is never deleted or changed.
                </p>
              </div>
              <button
                aria-label="Close import dialog"
                className="icon-button"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            {importCounts && (
              <>
                <div className="my-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  {Object.entries(importCounts).map(([label, count]) => (
                    <div className="rounded-lg bg-slate-50 p-3" key={label}>
                      <strong className="block text-lg">{count}</strong>
                      <span className="capitalize text-slate-600">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-600">
                  Import keeps original IDs and relationships. Existing records are not overwritten;
                  duplicate IDs and conflicting creator usernames are skipped. Bundled demo creators
                  are copied only when referenced by imported workspace records.
                </p>
              </>
            )}
            <button
              className="button button-secondary mt-5"
              onClick={downloadBackup}
              disabled={importing}
            >
              <Download size={15} /> Download complete raw backup
            </button>
            <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
              <input
                checked={backedUp}
                onChange={(event) => setBackedUp(event.target.checked)}
                type="checkbox"
              />
              <span>
                I saved the backup and understand that malformed records may need manual review.
              </span>
            </label>
            {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
            {result && (
              <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
                Import complete: {result.creators} creators, {result.campaigns} campaigns,
                {result.associations} campaign links, {result.shortlist} shortlist entries,
                {result.outreach} outreach records, {result.events} events, and
                {result.templates} templates imported; {result.skipped} duplicates or unresolved
                records skipped. The local copy remains intact.
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button className="button button-secondary" onClick={() => setOpen(false)}>
                Close
              </button>
              <button
                className="button button-primary"
                disabled={!backedUp || importing || !localData}
                onClick={importData}
              >
                {importing ? "Importing..." : "Import to workspace"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
