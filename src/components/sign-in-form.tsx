"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function SignInForm({
  provider
}: {
  provider: "credentials" | "google" | "wca";
}) {
  const [error, setError] = useState<string | null>(null);

  if (provider === "wca") {
    return (
      <button type="button" onClick={() => signIn("wca", { callbackUrl: "/" })}>
        Continue with WCA
      </button>
    );
  }

  if (provider === "google") {
    return (
      <button type="button" onClick={() => signIn("google", { callbackUrl: "/" })}>
        Continue with Google
      </button>
    );
  }

  return (
    <form
      className="form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);

        const formData = new FormData(event.currentTarget);
        const result = await signIn("credentials", {
          email: formData.get("email"),
          password: formData.get("password"),
          callbackUrl: "/",
          redirect: false
        });

        if (result?.error) {
          setError("Invalid email or password.");
          return;
        }

        window.location.href = result?.url ?? "/";
      }}
    >
      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        defaultValue="admin@cubecast.test"
        required
      />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        defaultValue="password123"
        required
      />
      <button type="submit">Sign in with demo account</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
