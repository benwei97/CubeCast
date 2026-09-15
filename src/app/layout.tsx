import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "CubeCast",
  description: "Virtual prediction markets for competitive speedcubing."
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/competitions", label: "Competitions" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" }
];

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const sessionBalance =
    typeof session?.user?.balance === "number" ? session.user.balance : null;

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
                <span>
                  {sessionBalance !== null
                    ? `${sessionBalance.toLocaleString()} CubeCoins`
                    : "Session expired"}
                </span>
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
        <footer>
          CubeCoins are virtual and have no monetary value.
        </footer>
      </body>
    </html>
  );
}
