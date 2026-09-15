import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "CubeCast",
  description: "Free WCA speedcubing prediction slates."
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/picks", label: "My Picks" },
  { href: "/leaderboard", label: "Leaderboard" }
];

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            CubeCast
          </Link>
          <nav aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            {session?.user?.role === UserRole.ADMIN && (
              <Link href="/admin">Admin</Link>
            )}
          </nav>
          <div className="account">
            {session?.user ? (
              <>
                <span>{session.user.name ?? "Signed in"}</span>
                <SignOutButton />
              </>
            ) : (
              <Link className="button-link" href="/sign-in">
                Sign in
              </Link>
            )}
          </div>
        </header>
        <main>{children}</main>
        <footer>CubeCast is a free forecasting game. No deposits, stakes, or wagering.</footer>
      </body>
    </html>
  );
}
