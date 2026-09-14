import Link from "next/link";

import { auth } from "@/auth";
import { getAccountValue, getOpenPositionValue } from "@/lib/account-value";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LeaderboardMetric = "account" | "balance" | "open-value" | "resolved-payouts";

const metricOptions: Array<{
  label: string;
  value: LeaderboardMetric;
}> = [
  { label: "Account Value", value: "account" },
  { label: "Balance", value: "balance" },
  { label: "Open Value", value: "open-value" },
  { label: "Resolved Payouts", value: "resolved-payouts" }
];

export default async function LeaderboardPage({
  searchParams
}: {
  searchParams: Promise<{ metric?: string }>;
}) {
  const { metric } = await searchParams;
  const activeMetric = isLeaderboardMetric(metric) ? metric : "account";
  const session = await auth();
  const users = await prisma.user.findMany({
    include: {
      positions: {
        include: {
          market: {
            select: {
              yesSharesOutstanding: true,
              noSharesOutstanding: true
            }
          }
        }
      }
    }
  });

  const leaders = users
    .map((user) => {
      const openPositionValue = getOpenPositionValue(user.positions);
      const accountValue = getAccountValue({
        balance: user.balance,
        positions: user.positions
      });

      return {
        id: user.id,
        username: user.username,
        balance: user.balance,
        openPositionValue,
        accountValue,
        resolvedPayouts: user.positions.reduce(
          (total, position) => total + position.payout,
          0
        ),
        positionCount: user.positions.length
      };
    })
    .sort((left, right) => {
      const leftScore = getLeaderboardScore(left, activeMetric);
      const rightScore = getLeaderboardScore(right, activeMetric);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return right.accountValue - left.accountValue;
    });

  const currentUserRank = session?.user
    ? leaders.findIndex((leader) => leader.id === session.user.id) + 1
    : 0;

  return (
    <div className="page-stack">
      <section>
        <p className="eyebrow">Global rankings</p>
        <h1>Leaderboard</h1>
        <p>
          Rank users by account value, balance, open position value, or resolved
          market payouts.
        </p>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span>Top {getMetricLabel(activeMetric)}</span>
          <strong>
            {leaders[0]
              ? getLeaderboardScore(leaders[0], activeMetric).toLocaleString()
              : "0"}
          </strong>
          <small>{leaders[0]?.username ?? "No users yet"}</small>
        </article>
        <article className="summary-card">
          <span>Users ranked</span>
          <strong>{leaders.length.toLocaleString()}</strong>
          <small>Seeded and signed-up users</small>
        </article>
        <article className="summary-card">
          <span>Your rank</span>
          <strong>{currentUserRank > 0 ? `#${currentUserRank}` : "-"}</strong>
          <small>{session?.user ? session.user.name : "Sign in to rank"}</small>
        </article>
        <article className="summary-card">
          <span>Market positions</span>
          <strong>
            {leaders
              .reduce((total, leader) => total + leader.positionCount, 0)
              .toLocaleString()}
          </strong>
          <small>Across all users</small>
        </article>
      </section>

      <section>
        <div className="section-heading">
          <h2>Rankings</h2>
        </div>
        <div className="filter-bar">
          <div>
            <span>Rank by</span>
            {metricOptions.map((option) => (
              <Link
                className={activeMetric === option.value ? "is-active" : undefined}
                href={
                  option.value === "account"
                    ? "/leaderboard"
                    : `/leaderboard?metric=${option.value}`
                }
                key={option.value}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="leaderboard-table">
          <div className="leaderboard-header">
            <span>Rank</span>
            <span>User</span>
            <span>{getMetricLabel(activeMetric)}</span>
            <span>Balance</span>
            <span>Open value</span>
            <span>Payouts</span>
            <span>Positions</span>
          </div>
          {leaders.map((leader, index) => (
            <article
              className={
                leader.id === session?.user?.id
                  ? "leaderboard-row is-current-user"
                  : "leaderboard-row"
              }
              key={leader.id}
            >
              <strong>#{index + 1}</strong>
              <span>{leader.username}</span>
              <strong>
                {getLeaderboardScore(leader, activeMetric).toLocaleString()}
              </strong>
              <span>{leader.balance.toLocaleString()}</span>
              <span>{leader.openPositionValue.toLocaleString()}</span>
              <span>{leader.resolvedPayouts.toLocaleString()}</span>
              <span>{leader.positionCount.toLocaleString()}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

type Leader = {
  accountValue: number;
  balance: number;
  openPositionValue: number;
  resolvedPayouts: number;
};

function isLeaderboardMetric(metric?: string): metric is LeaderboardMetric {
  return metricOptions.some((option) => option.value === metric);
}

function getLeaderboardScore(leader: Leader, metric: LeaderboardMetric) {
  switch (metric) {
    case "balance":
      return leader.balance;
    case "open-value":
      return leader.openPositionValue;
    case "resolved-payouts":
      return leader.resolvedPayouts;
    case "account":
    default:
      return leader.accountValue;
  }
}

function getMetricLabel(metric: LeaderboardMetric) {
  return metricOptions.find((option) => option.value === metric)?.label ?? "Score";
}
