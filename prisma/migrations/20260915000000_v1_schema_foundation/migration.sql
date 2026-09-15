-- CreateEnum
CREATE TYPE "ContestSlateStatus" AS ENUM ('DRAFT', 'OPEN', 'LOCKED', 'SETTLING', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContestEntryStatus" AS ENUM ('DRAFT', 'VALID', 'LOCKED', 'FINALIZED', 'INVALID');

-- CreateEnum
CREATE TYPE "PredictionResultStatus" AS ENUM ('PENDING', 'CORRECT', 'INCORRECT', 'VOID', 'TIE');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'RESOLVED', 'VOID');

-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('SLATE_CREATE', 'SLATE_UPDATE', 'MARKET_CREATE', 'MARKET_PUBLISH', 'MARKET_VOID', 'MARKET_SETTLE', 'CONTEST_FINALIZE', 'PRIZE_UPDATE');

-- CreateEnum
CREATE TYPE "PrizeAwardStatus" AS ENUM ('DRAFT', 'PENDING', 'HELD', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'HELD', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MarketCategory" ADD VALUE 'ADVANCEMENT';
ALTER TYPE "MarketCategory" ADD VALUE 'PLACEMENT';
ALTER TYPE "MarketCategory" ADD VALUE 'PERFORMANCE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MarketStatus" ADD VALUE 'LOCKED';
ALTER TYPE "MarketStatus" ADD VALUE 'PENDING_RESULT';
ALTER TYPE "MarketStatus" ADD VALUE 'VOID';

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "scheduledEndAt" TIMESTAMP(3),
ADD COLUMN     "scheduledStartAt" TIMESTAMP(3),
ADD COLUMN     "sourceMetadata" JSONB,
ADD COLUMN     "wcaCompetitionId" TEXT;

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "eventName" TEXT,
ADD COLUMN     "lockAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "settlementRuleVersion" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN     "slateId" TEXT,
ADD COLUMN     "voidReason" TEXT;

-- CreateTable
CREATE TABLE "WCAIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wcaUserId" TEXT NOT NULL,
    "wcaId" TEXT,
    "name" TEXT NOT NULL,
    "countryIso2" TEXT,
    "avatarUrl" TEXT,
    "profileUrl" TEXT,
    "rawProfile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WCAIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestSlate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ContestSlateStatus" NOT NULL DEFAULT 'DRAFT',
    "lockAt" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "prizeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxPicks" INTEGER NOT NULL DEFAULT 10,
    "baseScore" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestSlate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestCompetition" (
    "id" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestCompetition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOption" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "sideKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "competitorWcaId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "status" "ContestEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "baseScore" INTEGER NOT NULL DEFAULT 1000,
    "lockedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "finalScore" INTEGER,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "hardestCorrectProbability" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "selectedMarketOptionId" TEXT NOT NULL,
    "selectedProbability" INTEGER NOT NULL,
    "resultStatus" "PredictionResultStatus" NOT NULL DEFAULT 'PENDING',
    "scoreChange" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementSnapshot" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "status" "SettlementStatus" NOT NULL,
    "winningMarketOptionId" TEXT,
    "settledByUserId" TEXT,
    "observedPublicationAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUrl" TEXT,
    "sourceCompetitionId" TEXT,
    "sourceEventId" TEXT,
    "sourceRoundId" TEXT,
    "sourcePersonId" TEXT,
    "resultValue" TEXT,
    "placement" INTEGER,
    "ruleVersion" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "hardestCorrectProbability" INTEGER,
    "isSharedRank" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "actionType" "AdminActionType" NOT NULL,
    "slateId" TEXT,
    "marketId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeAward" (
    "id" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PrizeAwardStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "prizeAwardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT,
    "providerRef" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WCAIdentity_userId_key" ON "WCAIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WCAIdentity_wcaUserId_key" ON "WCAIdentity"("wcaUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WCAIdentity_wcaId_key" ON "WCAIdentity"("wcaId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestSlate_slug_key" ON "ContestSlate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ContestCompetition_slateId_competitionId_key" ON "ContestCompetition"("slateId", "competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketOption_marketId_sideKey_key" ON "MarketOption"("marketId", "sideKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContestEntry_userId_slateId_key" ON "ContestEntry"("userId", "slateId");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_entryId_marketId_key" ON "Prediction"("entryId", "marketId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_entryId_key" ON "LeaderboardEntry"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_slateId_userId_key" ON "LeaderboardEntry"("slateId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_prizeAwardId_key" ON "Payout"("prizeAwardId");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_wcaCompetitionId_key" ON "Competition"("wcaCompetitionId");

-- AddForeignKey
ALTER TABLE "WCAIdentity" ADD CONSTRAINT "WCAIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestCompetition" ADD CONSTRAINT "ContestCompetition_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "ContestSlate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestCompetition" ADD CONSTRAINT "ContestCompetition_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "ContestSlate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOption" ADD CONSTRAINT "MarketOption_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestEntry" ADD CONSTRAINT "ContestEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestEntry" ADD CONSTRAINT "ContestEntry_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "ContestSlate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_selectedMarketOptionId_fkey" FOREIGN KEY ("selectedMarketOptionId") REFERENCES "MarketOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementSnapshot" ADD CONSTRAINT "SettlementSnapshot_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementSnapshot" ADD CONSTRAINT "SettlementSnapshot_winningMarketOptionId_fkey" FOREIGN KEY ("winningMarketOptionId") REFERENCES "MarketOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementSnapshot" ADD CONSTRAINT "SettlementSnapshot_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "ContestSlate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "ContestSlate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAward" ADD CONSTRAINT "PrizeAward_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "ContestSlate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAward" ADD CONSTRAINT "PrizeAward_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAward" ADD CONSTRAINT "PrizeAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_prizeAwardId_fkey" FOREIGN KEY ("prizeAwardId") REFERENCES "PrizeAward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
