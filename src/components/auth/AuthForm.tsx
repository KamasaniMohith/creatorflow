"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({
  mode,
  nextPath,
  notice,
}: {
  mode: "login" | "signup";
  nextPath: string;
  notice?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState(notice ?? null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "signup" && displayName.trim().length < 2) {
      setError("Enter a name with at least 2 characters.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (authError) throw authError;
        router.replace(nextPath);
        router.refresh();
      } else {
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", nextPath);
        const { data, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: callback.toString(),
          },
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("Check your email to confirm your account, then sign in.");
        } else {
          router.replace(nextPath);
          router.refresh();
        }
      }
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link className="text-sm font-semibold text-slate-600" href="/">
          CreatorFlow
        </Link>
        <h1 className="mt-6 text-2xl font-semibold text-slate-950">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {isSignup
            ? "Sign up to set up your agency workspace."
            : "Sign in to continue to your workspace."}
        </p>

        {message && (
          <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={submit}>
          {isSignup && (
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input
                autoComplete="name"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                maxLength={120}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              autoComplete="email"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button
            className="w-full rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {isSignup ? "Already registered? " : "New to CreatorFlow? "}
          <Link
            className="font-medium text-slate-950 underline"
            href={isSignup ? `/login?next=${encodeURIComponent(nextPath)}` : `/signup?next=${encodeURIComponent(nextPath)}`}
          >
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
