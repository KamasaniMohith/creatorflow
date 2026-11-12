"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createWorkspace } from "@/app/actions/workspaces";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

export function WorkspaceOnboarding({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [name, setName] = useState(displayName ? `${displayName}'s Agency` : "");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function changeName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createWorkspace({ name, slug });
      router.replace("/");
      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Workspace creation failed. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-sm font-semibold text-slate-600">CreatorFlow</div>
        <h1 className="mt-6 text-2xl font-semibold text-slate-950">
          Create your agency workspace
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your workspace is private to its members. You will be its owner.
        </p>
        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">
            Agency name
            <input
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
              maxLength={100}
              minLength={2}
              onChange={(event) => changeName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Workspace URL slug
            <input
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
              maxLength={63}
              minLength={3}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value.toLowerCase());
              }}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              value={slug}
            />
          </label>
          <button
            className="w-full rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "Creating workspace..." : "Create workspace"}
          </button>
        </form>
      </section>
    </main>
  );
}
