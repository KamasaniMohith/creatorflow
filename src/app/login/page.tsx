import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string; error?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
          <p role="status">Loading sign-in form...</p>
        </main>
      }
    >
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/onboarding";
  const notice =
    params.message === "check-email"
      ? "Check your email to confirm your account before signing in."
      : params.error === "callback"
        ? "The sign-in confirmation link could not be completed. Please sign in or request another confirmation email."
        : undefined;

  return <AuthForm mode="login" nextPath={nextPath} notice={notice} />;
}
