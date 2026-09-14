import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

import { STARTING_BALANCE } from "../src/lib/onboarding";
import { normalizeUsername } from "../src/lib/username";

const prisma = new PrismaClient();

const now = new Date();
const day = 24 * 60 * 60 * 1000;

function dateFromNow(days: number) {
  return new Date(now.getTime() + days * day);
}

async function createSeedUser(input: {
  email: string;
  username: string;
  role?: "USER" | "ADMIN";
  balance?: number;
}) {
  const passwordHash = await hash("password123", 10);
  const balance = input.balance ?? STARTING_BALANCE;

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      usernameLower: normalizeUsername(input.username),
      role: input.role ?? "USER",
      balance,
      passwordHash
    }
  });

  await prisma.ledgerTransaction.create({
    data: {
      userId: user.id,
      type: "STARTING_BALANCE",
      amount: STARTING_BALANCE,
      balanceAfter: STARTING_BALANCE,
      description: "Starting CubeCoins balance"
    }
  });

  return user;
}

async function createMarket(input: {
  competitionId: string;
  createdByUserId: string;
  question: string;
  slug: string;
  description: string;
  category:
    | "WINNER"
    | "PODIUM"
    | "RECORD"
    | "TIME_THRESHOLD"
    | "HEAD_TO_HEAD"
    | "OTHER";
  closeTime: Date;
  liquidityParameter?: number;
}) {
  return prisma.market.create({
    data: {
      competitionId: input.competitionId,
      createdByUserId: input.createdByUserId,
      question: input.question,
      slug: input.slug,
      description: input.description,
      category: input.category,
      resolutionRules:
        "Resolves from official WCA-style final results. The market cancels if no official result is published for the relevant event or round.",
      resolutionSource: "Official WCA competition results",
      status: "OPEN",
      closeTime: input.closeTime,
      liquidityParameter: input.liquidityParameter ?? 1000
    }
  });
}

async function main() {
  await prisma.settlement.deleteMany();
  await prisma.ledgerTransaction.deleteMany();
  await prisma.position.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.market.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const [admin, maya, felix, , theo, arden] = await Promise.all([
    createSeedUser({
      email: "admin@cubecast.test",
      username: "admin",
      role: "ADMIN",
      balance: 2780
    }),
    createSeedUser({
      email: "maya@cubecast.test",
      username: "maya_cube",
      balance: 1440
    }),
    createSeedUser({
      email: "felix@cubecast.test",
      username: "felixturns",
      balance: 1185
    }),
    createSeedUser({
      email: "nina@cubecast.test",
      username: "nina_solver",
      balance: 910
    }),
    createSeedUser({
      email: "theo@cubecast.test",
      username: "theo_oh",
      balance: 760
    }),
    createSeedUser({
      email: "arden@cubecast.test",
      username: "arden3x3",
      balance: 2025
    })
  ]);

  const worlds = await prisma.competition.create({
    data: {
      name: "WCA World Championship 2027",
      slug: "wca-world-championship-2027",
      description: "A fictional demo championship for validating CubeCast.",
      location: "Seoul",
      country: "KR",
      startDate: dateFromNow(40),
      endDate: dateFromNow(43),
      status: "UPCOMING",
      officialUrl: "https://www.worldcubeassociation.org/"
    }
  });

  const nationals = await prisma.competition.create({
    data: {
      name: "CubingUSA Nationals 2027",
      slug: "cubingusa-nationals-2027",
      description: "A fictional demo national competition.",
      location: "Chicago, IL",
      country: "US",
      startDate: dateFromNow(75),
      endDate: dateFromNow(78),
      status: "UPCOMING",
      officialUrl: "https://www.worldcubeassociation.org/"
    }
  });

  const resolvedCup = await prisma.competition.create({
    data: {
      name: "CubeCast Spring Invitational",
      slug: "cubecast-spring-invitational",
      description: "Completed demo event with resolved markets.",
      location: "Portland, OR",
      country: "US",
      startDate: dateFromNow(-20),
      endDate: dateFromNow(-18),
      status: "COMPLETED"
    }
  });

  const markets = await Promise.all([
    createMarket({
      competitionId: worlds.id,
      createdByUserId: admin.id,
      question: "Will Competitor A win 3x3?",
      slug: "worlds-2027-competitor-a-win-3x3",
      description: "Prediction on the official 3x3 final winner.",
      category: "WINNER",
      closeTime: dateFromNow(39),
      liquidityParameter: 1200
    }),
    createMarket({
      competitionId: worlds.id,
      createdByUserId: admin.id,
      question: "Will Competitor B podium in 3x3?",
      slug: "worlds-2027-competitor-b-podium-3x3",
      description: "YES if Competitor B finishes first, second, or third.",
      category: "PODIUM",
      closeTime: dateFromNow(39),
      liquidityParameter: 1200
    }),
    createMarket({
      competitionId: worlds.id,
      createdByUserId: admin.id,
      question: "Will a 3x3 world record be broken?",
      slug: "worlds-2027-3x3-world-record",
      description: "Any official 3x3 single or average world record counts.",
      category: "RECORD",
      closeTime: dateFromNow(39),
      liquidityParameter: 1500
    }),
    createMarket({
      competitionId: worlds.id,
      createdByUserId: admin.id,
      question: "Will Competitor C average under 5.00 in the final?",
      slug: "worlds-2027-competitor-c-under-500",
      description: "YES if the official final average is below 5.00 seconds.",
      category: "TIME_THRESHOLD",
      closeTime: dateFromNow(39)
    }),
    createMarket({
      competitionId: nationals.id,
      createdByUserId: admin.id,
      question: "Will Competitor D win 4x4?",
      slug: "nationals-2027-competitor-d-win-4x4",
      description: "Prediction on the official 4x4 final winner.",
      category: "WINNER",
      closeTime: dateFromNow(74)
    }),
    createMarket({
      competitionId: nationals.id,
      createdByUserId: admin.id,
      question: "Will Competitor E make the 3x3 final?",
      slug: "nationals-2027-competitor-e-3x3-final",
      description: "YES if Competitor E is listed in the final round.",
      category: "OTHER",
      closeTime: dateFromNow(74)
    }),
    createMarket({
      competitionId: nationals.id,
      createdByUserId: admin.id,
      question: "Will more than one national record be broken?",
      slug: "nationals-2027-more-than-one-national-record",
      description: "YES if at least two national records are broken.",
      category: "RECORD",
      closeTime: dateFromNow(74),
      liquidityParameter: 1300
    }),
    createMarket({
      competitionId: nationals.id,
      createdByUserId: admin.id,
      question: "Will Competitor F finish above Competitor G?",
      slug: "nationals-2027-competitor-f-above-g",
      description: "YES if Competitor F has the better official placement.",
      category: "HEAD_TO_HEAD",
      closeTime: dateFromNow(74)
    })
  ]);

  const resolvedMarket = await prisma.market.create({
    data: {
      competitionId: resolvedCup.id,
      createdByUserId: admin.id,
      question: "Did Competitor H win the Spring Invitational 3x3 final?",
      slug: "spring-invitational-competitor-h-win-3x3",
      description: "Resolved demo market.",
      category: "WINNER",
      resolutionRules:
        "Resolves from official WCA-style final results. The market cancels if no official result is published.",
      resolutionSource: "Official WCA competition results",
      status: "RESOLVED",
      closeTime: dateFromNow(-19),
      resolvedAt: dateFromNow(-18),
      winningOutcome: "YES",
      yesSharesOutstanding: 14,
      noSharesOutstanding: 7,
      liquidityParameter: 1000
    }
  });

  const [mayaPurchase, felixPurchase] = await Promise.all([
    prisma.purchase.create({
      data: {
        userId: maya.id,
        marketId: markets[0].id,
        outcome: "YES",
        quantity: 5,
        totalCost: 250,
        averagePrice: 50
      }
    }),
    prisma.purchase.create({
      data: {
        userId: felix.id,
        marketId: markets[1].id,
        outcome: "NO",
        quantity: 8,
        totalCost: 400,
        averagePrice: 50
      }
    })
  ]);

  await Promise.all([
    prisma.position.create({
      data: {
        userId: maya.id,
        marketId: markets[0].id,
        yesShares: 5,
        totalYesCost: 250,
        status: "OPEN"
      }
    }),
    prisma.position.create({
      data: {
        userId: felix.id,
        marketId: markets[1].id,
        noShares: 8,
        totalNoCost: 400,
        status: "OPEN"
      }
    }),
    prisma.position.create({
      data: {
        userId: arden.id,
        marketId: resolvedMarket.id,
        yesShares: 14,
        totalYesCost: 700,
        payout: 1400,
        status: "WON"
      }
    }),
    prisma.position.create({
      data: {
        userId: theo.id,
        marketId: resolvedMarket.id,
        noShares: 7,
        totalNoCost: 350,
        payout: 0,
        status: "LOST"
      }
    }),
    prisma.ledgerTransaction.create({
      data: {
        userId: maya.id,
        marketId: markets[0].id,
        purchaseId: mayaPurchase.id,
        type: "MARKET_PURCHASE",
        amount: -250,
        balanceAfter: maya.balance,
        description: "Bought 5 YES shares"
      }
    }),
    prisma.ledgerTransaction.create({
      data: {
        userId: felix.id,
        marketId: markets[1].id,
        purchaseId: felixPurchase.id,
        type: "MARKET_PURCHASE",
        amount: -400,
        balanceAfter: felix.balance,
        description: "Bought 8 NO shares"
      }
    }),
    prisma.ledgerTransaction.create({
      data: {
        userId: arden.id,
        marketId: resolvedMarket.id,
        type: "MARKET_PAYOUT",
        amount: 1400,
        balanceAfter: arden.balance,
        description: "Payout for winning YES shares"
      }
    })
  ]);

  await prisma.settlement.create({
    data: {
      marketId: resolvedMarket.id,
      outcome: "YES",
      settledByUserId: admin.id,
      totalPayout: 1400
    }
  });

  await prisma.market.update({
    where: { id: markets[0].id },
    data: { yesSharesOutstanding: 5 }
  });

  await prisma.market.update({
    where: { id: markets[1].id },
    data: { noSharesOutstanding: 8 }
  });

  console.log("Seeded CubeCast demo data.");
  console.log("Demo admin: admin@cubecast.test / password123");
  console.log("Demo user: maya@cubecast.test / password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
