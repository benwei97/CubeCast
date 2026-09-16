import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

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
}) {
  const passwordHash = await hash("password123", 10);

  return prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      usernameLower: normalizeUsername(input.username),
      role: input.role ?? "USER",
      passwordHash
    }
  });
}

async function createWcaIdentity(input: {
  userId: string;
  wcaUserId: string;
  wcaId?: string;
  name: string;
  countryIso2?: string;
}) {
  return prisma.wCAIdentity.create({
    data: {
      userId: input.userId,
      wcaUserId: input.wcaUserId,
      wcaId: input.wcaId,
      name: input.name,
      countryIso2: input.countryIso2,
      profileUrl: `https://www.worldcubeassociation.org/persons/${input.wcaId ?? input.wcaUserId}`,
      rawProfile: {
        seeded: true,
        source: "local development seed"
      }
    }
  });
}

async function createV1Market(input: {
  slateId: string;
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
    | "ADVANCEMENT"
    | "PLACEMENT"
    | "PERFORMANCE"
    | "OTHER";
  eventId: string;
  eventName: string;
  lockAt: Date;
  options: Array<{
    sideKey: "YES" | "NO";
    label: string;
    probability: number;
    competitorWcaId?: string;
  }>;
}) {
  return prisma.market.create({
    data: {
      competitionId: input.competitionId,
      slateId: input.slateId,
      createdByUserId: input.createdByUserId,
      question: input.question,
      slug: input.slug,
      description: input.description,
      category: input.category,
      eventId: input.eventId,
      eventName: input.eventName,
      resolutionRules:
        "Resolves from first-published official WCA results using CubeCast V1 settlement rules.",
      resolutionSource: "Official WCA competition results",
      settlementRuleVersion: "v1",
      status: "OPEN",
      closeTime: input.lockAt,
      lockAt: input.lockAt,
      publishedAt: now,
      options: {
        create: input.options.map((option, index) => ({
          ...option,
          displayOrder: index
        }))
      }
    }
  });
}

async function main() {
  await prisma.payout.deleteMany();
  await prisma.prizeAward.deleteMany();
  await prisma.leaderboardEntry.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.contestEntry.deleteMany();
  await prisma.settlementSnapshot.deleteMany();
  await prisma.adminAction.deleteMany();
  await prisma.marketOption.deleteMany();
  await prisma.contestCompetition.deleteMany();
  await prisma.contestSlate.deleteMany();
  await prisma.wCAIdentity.deleteMany();
  await prisma.market.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const [admin, maya, felix, , theo, arden] = await Promise.all([
    createSeedUser({
      email: "admin@cubecast.test",
      username: "admin",
      role: "ADMIN"
    }),
    createSeedUser({
      email: "maya@cubecast.test",
      username: "maya_cube"
    }),
    createSeedUser({
      email: "felix@cubecast.test",
      username: "felixturns"
    }),
    createSeedUser({
      email: "nina@cubecast.test",
      username: "nina_solver"
    }),
    createSeedUser({
      email: "theo@cubecast.test",
      username: "theo_oh"
    }),
    createSeedUser({
      email: "arden@cubecast.test",
      username: "arden3x3"
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
      scheduledStartAt: dateFromNow(40),
      scheduledEndAt: dateFromNow(43),
      status: "UPCOMING",
      officialUrl: "https://www.worldcubeassociation.org/",
      wcaCompetitionId: "WC2027",
      sourceMetadata: {
        seeded: true,
        championship: true
      }
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
      scheduledStartAt: dateFromNow(75),
      scheduledEndAt: dateFromNow(78),
      status: "UPCOMING",
      officialUrl: "https://www.worldcubeassociation.org/",
      wcaCompetitionId: "CubingUSANationals2027",
      sourceMetadata: {
        seeded: true,
        championship: true
      }
    }
  });

  await Promise.all([
    createWcaIdentity({
      userId: maya.id,
      wcaUserId: "seed-wca-user-maya",
      wcaId: "2019MAYA01",
      name: "Maya Cube",
      countryIso2: "US"
    }),
    createWcaIdentity({
      userId: felix.id,
      wcaUserId: "seed-wca-user-felix",
      wcaId: "2018FELX01",
      name: "Felix Turns",
      countryIso2: "US"
    }),
    createWcaIdentity({
      userId: theo.id,
      wcaUserId: "seed-wca-user-theo",
      wcaId: "2020THEO01",
      name: "Theo Oh",
      countryIso2: "KR"
    }),
    createWcaIdentity({
      userId: arden.id,
      wcaUserId: "seed-wca-user-arden",
      wcaId: "2017ARDN01",
      name: "Arden Solver",
      countryIso2: "CA"
    })
  ]);

  const v1LockAt = new Date(worlds.startDate.getTime() - 60 * 60 * 1000);
  const v1Slate = await prisma.contestSlate.create({
    data: {
      title: "Worlds Preview Slate",
      slug: "worlds-preview-slate",
      description:
        "Demo V1 slate with fixed-probability WCA prediction markets.",
      diversityConfig: {
        maxPerCompetition: 16,
        maxPerCompetitor: 6,
        maxPerEvent: 12,
        maxPerMarketType: 8
      },
      status: "OPEN",
      startsAt: worlds.startDate,
      endsAt: nationals.endDate,
      lockAt: v1LockAt,
      publishedAt: now,
      competitions: {
        create: [
          {
            competitionId: worlds.id
          },
          {
            competitionId: nationals.id
          }
        ]
      }
    }
  });

  await prisma.adminAction.create({
    data: {
      adminUserId: admin.id,
      slateId: v1Slate.id,
      actionType: "SLATE_CREATE",
      metadata: {
        seeded: true,
        title: v1Slate.title
      }
    }
  });

  const v1Markets = [
    {
      competitionId: worlds.id,
      question: "Who places higher in 3x3?",
      slug: "v1-worlds-max-vs-tymon-3x3",
      description: "Head-to-head result in 3x3 using official WCA placement.",
      category: "HEAD_TO_HEAD" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Max Park", probability: 60, competitorWcaId: "2012PARK03" },
        { sideKey: "NO" as const, label: "Tymon Kolasinski", probability: 40, competitorWcaId: "2016KOLA02" }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Will Max Park qualify for Finals?",
      slug: "v1-worlds-max-3x3-finals",
      description: "YES if Max earns a qualifying position for the final round.",
      category: "ADVANCEMENT" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 64, competitorWcaId: "2012PARK03" },
        { sideKey: "NO" as const, label: "No", probability: 36, competitorWcaId: "2012PARK03" }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Will Tymon Kolasinski podium in 3x3?",
      slug: "v1-worlds-tymon-3x3-podium",
      description: "YES if Tymon finishes top 3 in the official final round.",
      category: "PLACEMENT" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 45, competitorWcaId: "2016KOLA02" },
        { sideKey: "NO" as const, label: "No", probability: 55, competitorWcaId: "2016KOLA02" }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Will Yiheng Wang record a sub-5.80 average in 3x3?",
      slug: "v1-worlds-yiheng-sub-580",
      description: "YES if any official 3x3 average is below 5.80 seconds.",
      category: "PERFORMANCE" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 52, competitorWcaId: "2019WANY36" },
        { sideKey: "NO" as const, label: "No", probability: 48, competitorWcaId: "2019WANY36" }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Who places higher in 4x4?",
      slug: "v1-worlds-sebastian-vs-max-4x4",
      description: "Head-to-head result in 4x4 using official WCA placement.",
      category: "HEAD_TO_HEAD" as const,
      eventId: "444",
      eventName: "4x4",
      options: [
        { sideKey: "YES" as const, label: "Sebastian Weyer", probability: 55, competitorWcaId: "2009WEYE02" },
        { sideKey: "NO" as const, label: "Max Park", probability: 45, competitorWcaId: "2012PARK03" }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Will Ruihang Xu finish Top 8 in 3x3?",
      slug: "v1-worlds-ruihang-top-8-3x3",
      description: "YES if Ruihang finishes top 8 in the official final round.",
      category: "PLACEMENT" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 58, competitorWcaId: "2017XURU04" },
        { sideKey: "NO" as const, label: "No", probability: 42, competitorWcaId: "2017XURU04" }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Will a 3x3 world record be broken?",
      slug: "v1-worlds-3x3-world-record",
      description: "YES if any official 3x3 single or average world record is broken.",
      category: "RECORD" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 38 },
        { sideKey: "NO" as const, label: "No", probability: 62 }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Will Matty Hiroto Inaba qualify for Finals?",
      slug: "v1-worlds-matty-3x3-finals",
      description: "YES if Matty earns a qualifying position for the final round.",
      category: "ADVANCEMENT" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 49, competitorWcaId: "2014INAB01" },
        { sideKey: "NO" as const, label: "No", probability: 51, competitorWcaId: "2014INAB01" }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Who places higher in 2x2?",
      slug: "v1-worlds-teodor-vs-zayn-2x2",
      description: "Head-to-head result in 2x2 using official WCA placement.",
      category: "HEAD_TO_HEAD" as const,
      eventId: "222",
      eventName: "2x2",
      options: [
        { sideKey: "YES" as const, label: "Teodor Zajder", probability: 53 },
        { sideKey: "NO" as const, label: "Zayn Khanani", probability: 47 }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Will Juliette Sebastien podium in Pyraminx?",
      slug: "v1-worlds-juliette-pyraminx-podium",
      description: "YES if Juliette finishes top 3 in the official Pyraminx final.",
      category: "PLACEMENT" as const,
      eventId: "pyram",
      eventName: "Pyraminx",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 41 },
        { sideKey: "NO" as const, label: "No", probability: 59 }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Will Max Park win 5x5?",
      slug: "v1-worlds-max-win-5x5",
      description: "YES if Max wins the official 5x5 final.",
      category: "WINNER" as const,
      eventId: "555",
      eventName: "5x5",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 61, competitorWcaId: "2012PARK03" },
        { sideKey: "NO" as const, label: "No", probability: 39, competitorWcaId: "2012PARK03" }
      ]
    },
    {
      competitionId: worlds.id,
      question: "Will Tymon record a sub-6.20 average in 3x3?",
      slug: "v1-worlds-tymon-sub-620",
      description: "YES if any official 3x3 average is below 6.20 seconds.",
      category: "PERFORMANCE" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 57, competitorWcaId: "2016KOLA02" },
        { sideKey: "NO" as const, label: "No", probability: 43, competitorWcaId: "2016KOLA02" }
      ]
    },
    {
      competitionId: nationals.id,
      question: "Will Andy Smith podium in 3x3?",
      slug: "v1-nationals-andy-3x3-podium",
      description: "YES if Andy finishes top 3 in the official final round.",
      category: "PLACEMENT" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 43 },
        { sideKey: "NO" as const, label: "No", probability: 57 }
      ]
    },
    {
      competitionId: nationals.id,
      question: "Who places higher in 3x3?",
      slug: "v1-nationals-andy-vs-brian-3x3",
      description: "Head-to-head result in 3x3 using official WCA placement.",
      category: "HEAD_TO_HEAD" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Andy Smith", probability: 50 },
        { sideKey: "NO" as const, label: "Brian Chen", probability: 50 }
      ]
    },
    {
      competitionId: nationals.id,
      question: "Will Emily Wang qualify for Finals?",
      slug: "v1-nationals-emily-3x3-finals",
      description: "YES if Emily earns a qualifying position for the final round.",
      category: "ADVANCEMENT" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 46 },
        { sideKey: "NO" as const, label: "No", probability: 54 }
      ]
    },
    {
      competitionId: nationals.id,
      question: "Will a national record be broken in 4x4?",
      slug: "v1-nationals-4x4-national-record",
      description: "YES if any official 4x4 national record is broken.",
      category: "RECORD" as const,
      eventId: "444",
      eventName: "4x4",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 36 },
        { sideKey: "NO" as const, label: "No", probability: 64 }
      ]
    },
    {
      competitionId: nationals.id,
      question: "Will Carter Jones finish Top 8 in 3x3?",
      slug: "v1-nationals-carter-top-8-3x3",
      description: "YES if Carter finishes top 8 in the official final round.",
      category: "PLACEMENT" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 55 },
        { sideKey: "NO" as const, label: "No", probability: 45 }
      ]
    },
    {
      competitionId: nationals.id,
      question: "Will Sophia Lee record a sub-8.00 average in 3x3?",
      slug: "v1-nationals-sophia-sub-800",
      description: "YES if any official 3x3 average is below 8.00 seconds.",
      category: "PERFORMANCE" as const,
      eventId: "333",
      eventName: "3x3",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 48 },
        { sideKey: "NO" as const, label: "No", probability: 52 }
      ]
    },
    {
      competitionId: nationals.id,
      question: "Who places higher in OH?",
      slug: "v1-nationals-lucas-vs-noah-oh",
      description: "Head-to-head result in one-handed using official WCA placement.",
      category: "HEAD_TO_HEAD" as const,
      eventId: "333oh",
      eventName: "3x3 One-Handed",
      options: [
        { sideKey: "YES" as const, label: "Lucas Miller", probability: 44 },
        { sideKey: "NO" as const, label: "Noah Brown", probability: 56 }
      ]
    },
    {
      competitionId: nationals.id,
      question: "Will Olivia Kim win Megaminx?",
      slug: "v1-nationals-olivia-win-megaminx",
      description: "YES if Olivia wins the official Megaminx final.",
      category: "WINNER" as const,
      eventId: "minx",
      eventName: "Megaminx",
      options: [
        { sideKey: "YES" as const, label: "Yes", probability: 39 },
        { sideKey: "NO" as const, label: "No", probability: 61 }
      ]
    }
  ];

  await Promise.all(
    v1Markets.map((market) =>
      createV1Market({
        ...market,
        slateId: v1Slate.id,
        createdByUserId: admin.id,
        lockAt: v1LockAt
      })
    )
  );

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
