import { strict as assert } from "node:assert";

import {
  MarketCategory,
  MarketOutcome,
  MarketStatus,
  PositionStatus,
  UserRole
} from "@prisma/client";

import { prisma } from "../src/lib/prisma";
import { buySharesForUser, resolveMarketForAdmin } from "../src/lib/trading";

const runId = `trading-smoke-${Date.now()}`;

async function createFixture({
  userBalance = 1000
}: {
  userBalance?: number;
} = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const admin = await prisma.user.create({
    data: {
      email: `${runId}-admin-${suffix}@cubecast.test`,
      username: `smoke_admin_${suffix}`.slice(0, 20),
      usernameLower: `smoke_admin_${suffix}`.slice(0, 20),
      role: UserRole.ADMIN,
      balance: 1000
    }
  });
  const user = await prisma.user.create({
    data: {
      email: `${runId}-user-${suffix}@cubecast.test`,
      username: `smoke_user_${suffix}`.slice(0, 20),
      usernameLower: `smoke_user_${suffix}`.slice(0, 20),
      role: UserRole.USER,
      balance: userBalance
    }
  });
  const competition = await prisma.competition.create({
    data: {
      name: `${runId} Competition`,
      slug: `${runId}-competition-${Math.random()}`,
      description: "Temporary trading smoke test competition.",
      location: "Test City",
      country: "US",
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: "UPCOMING"
    }
  });
  const market = await prisma.market.create({
    data: {
      competitionId: competition.id,
      createdByUserId: admin.id,
      question: `${runId} market?`,
      slug: `${runId}-market-${Math.random()}`,
      description: "Temporary trading smoke test market.",
      category: MarketCategory.WINNER,
      resolutionRules: "Temporary market resolves from smoke test action.",
      resolutionSource: "Smoke test",
      status: MarketStatus.OPEN,
      closeTime: new Date(Date.now() + 60 * 60 * 1000),
      liquidityParameter: 1000
    }
  });

  return { admin, competition, market, user };
}

async function cleanup() {
  await prisma.ledgerTransaction.deleteMany({
    where: { user: { email: { contains: runId } } }
  });
  await prisma.settlement.deleteMany({
    where: { market: { slug: { contains: runId } } }
  });
  await prisma.position.deleteMany({
    where: { market: { slug: { contains: runId } } }
  });
  await prisma.purchase.deleteMany({
    where: { market: { slug: { contains: runId } } }
  });
  await prisma.market.deleteMany({
    where: { slug: { contains: runId } }
  });
  await prisma.competition.deleteMany({
    where: { slug: { contains: runId } }
  });
  await prisma.user.deleteMany({
    where: { email: { contains: runId } }
  });
}

async function testBuyShares() {
  const { market, user } = await createFixture();
  const result = await prisma.$transaction((tx) =>
    buySharesForUser({
      outcome: MarketOutcome.YES,
      quantity: 2,
      slug: market.slug,
      tx,
      userId: user.id
    })
  );

  assert.equal(result.status, "success");

  const [updatedUser, updatedMarket, position, purchase, ledger] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      prisma.market.findUniqueOrThrow({ where: { id: market.id } }),
      prisma.position.findUniqueOrThrow({
        where: { userId_marketId: { userId: user.id, marketId: market.id } }
      }),
      prisma.purchase.findFirstOrThrow({ where: { marketId: market.id } }),
      prisma.ledgerTransaction.findFirstOrThrow({
        where: { userId: user.id, marketId: market.id }
      })
    ]);

  assert.equal(updatedUser.balance, 900);
  assert.equal(updatedMarket.yesSharesOutstanding, 2);
  assert.equal(position.yesShares, 2);
  assert.equal(position.totalYesCost, 100);
  assert.equal(purchase.totalCost, 100);
  assert.equal(ledger.amount, -100);
}

async function testInsufficientBalance() {
  const { market, user } = await createFixture({ userBalance: 25 });
  const result = await prisma.$transaction((tx) =>
    buySharesForUser({
      outcome: MarketOutcome.YES,
      quantity: 1,
      slug: market.slug,
      tx,
      userId: user.id
    })
  );

  assert.equal(result.status, "insufficient-balance");
}

async function testResolvePayout() {
  const { admin, market, user } = await createFixture();

  await prisma.$transaction((tx) =>
    buySharesForUser({
      outcome: MarketOutcome.YES,
      quantity: 3,
      slug: market.slug,
      tx,
      userId: user.id
    })
  );

  const result = await prisma.$transaction((tx) =>
    resolveMarketForAdmin({
      adminUserId: admin.id,
      outcome: MarketOutcome.YES,
      slug: market.slug,
      tx
    })
  );

  assert.equal(result.status, "success");

  const [updatedUser, updatedMarket, position, settlement] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
    prisma.market.findUniqueOrThrow({ where: { id: market.id } }),
    prisma.position.findUniqueOrThrow({
      where: { userId_marketId: { userId: user.id, marketId: market.id } }
    }),
    prisma.settlement.findUniqueOrThrow({ where: { marketId: market.id } })
  ]);

  assert.equal(updatedUser.balance, 1150);
  assert.equal(updatedMarket.status, MarketStatus.RESOLVED);
  assert.equal(updatedMarket.winningOutcome, MarketOutcome.YES);
  assert.equal(position.status, PositionStatus.WON);
  assert.equal(position.payout, 300);
  assert.equal(settlement.totalPayout, 300);
}

async function testCancelRefund() {
  const { admin, market, user } = await createFixture();

  await prisma.$transaction((tx) =>
    buySharesForUser({
      outcome: MarketOutcome.NO,
      quantity: 2,
      slug: market.slug,
      tx,
      userId: user.id
    })
  );

  const result = await prisma.$transaction((tx) =>
    resolveMarketForAdmin({
      adminUserId: admin.id,
      outcome: "CANCELED",
      slug: market.slug,
      tx
    })
  );

  assert.equal(result.status, "success");

  const [updatedUser, updatedMarket, position] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
    prisma.market.findUniqueOrThrow({ where: { id: market.id } }),
    prisma.position.findUniqueOrThrow({
      where: { userId_marketId: { userId: user.id, marketId: market.id } }
    })
  ]);

  assert.equal(updatedUser.balance, 1000);
  assert.equal(updatedMarket.status, MarketStatus.CANCELED);
  assert.equal(position.status, PositionStatus.REFUNDED);
  assert.equal(position.payout, 100);
}

async function main() {
  await cleanup();
  await testBuyShares();
  await testInsufficientBalance();
  await testResolvePayout();
  await testCancelRefund();
  await cleanup();
  console.log("Trading smoke tests passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    await cleanup();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
