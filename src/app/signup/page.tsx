import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
          <p role="status">Loading sign-up form...</p>
        </main>
      }
    >
      <SignupForm searchParams={searchParams} />
    </Suspense>
  );
}

async function SignupForm({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/onboarding";

  return <AuthForm mode="signup" nextPath={nextPath} />;
}
