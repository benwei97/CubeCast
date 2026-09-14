import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  const googleEnabled =
    Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Welcome to CubeCast</p>
        <h1>Sign in</h1>
        <p>
          Use a seeded demo account locally, or configure Google OAuth in
          production.
        </p>
        {googleEnabled && (
          <SignInForm provider="google" />
        )}
        <SignInForm provider="credentials" />
        <p className="disclaimer">
          CubeCoins are virtual and have no monetary value.
        </p>
      </section>
    </div>
  );
}
