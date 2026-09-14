import { auth } from "@/auth";
import { getAccountValue, getOpenPositionValue } from "@/lib/account-value";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
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
        positionCount: user.positions.length
      };
    })
    .sort((left, right) => {
      if (right.accountValue !== left.accountValue) {
        return right.accountValue - left.accountValue;
      }

      return right.balance - left.balance;
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
          Rank users by estimated account value: available CubeCoins plus open
          position value at current mock market prices.
        </p>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span>Top account</span>
          <strong>{leaders[0]?.accountValue.toLocaleString() ?? "0"}</strong>
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
        <div className="leaderboard-table">
          <div className="leaderboard-header">
            <span>Rank</span>
            <span>User</span>
            <span>Account value</span>
            <span>Balance</span>
            <span>Open value</span>
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
              <strong>{leader.accountValue.toLocaleString()}</strong>
              <span>{leader.balance.toLocaleString()}</span>
              <span>{leader.openPositionValue.toLocaleString()}</span>
              <span>{leader.positionCount.toLocaleString()}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
