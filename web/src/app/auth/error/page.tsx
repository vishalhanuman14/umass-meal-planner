import Link from "next/link";

type AuthErrorPageProps = {
  searchParams: Promise<{
    reason?: string | string[];
  }>;
};

function messageForReason(reason: string | null) {
  if (reason === "umass") {
    return "Use your @umass.edu Google account to sign in.";
  }

  return "Google sign-in did not finish cleanly. Try again.";
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : null;

  return (
    <main className="page-shell">
      <section className="card card-pad card-warm empty-state">
        <span className="eyebrow">Sign-In Error</span>
        <h1 className="hero-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
          Couldn&apos;t finish sign-in.
        </h1>
        <p className="muted">{messageForReason(reason)}</p>
        <div className="cta-row" style={{ justifyContent: "center" }}>
          <Link href="/" className="button button-primary">
            Back to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
