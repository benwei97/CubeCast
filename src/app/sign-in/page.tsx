import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  const googleEnabled =
    Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);
  const wcaEnabled =
    Boolean(process.env.AUTH_WCA_ID) && Boolean(process.env.AUTH_WCA_SECRET);

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Welcome to CubeCast</p>
        <h1>Sign in</h1>
        <p>
          WCA login is the production identity for CubeCast. Seeded demo
          accounts remain available for local development.
        </p>
        {wcaEnabled && <SignInForm provider="wca" />}
        {googleEnabled && <SignInForm provider="google" />}
        <SignInForm provider="credentials" />
        <p className="disclaimer">
          CubeCast is a free forecasting game. No deposits, stakes, or wagering.
        </p>
      </section>
    </div>
  );
}
