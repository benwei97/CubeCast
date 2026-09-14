-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'RESOLVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MarketOutcome" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "MarketCategory" AS ENUM ('WINNER', 'PODIUM', 'RECORD', 'TIME_THRESHOLD', 'HEAD_TO_HEAD', 'OTHER');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('STARTING_BALANCE', 'MARKET_PURCHASE', 'MARKET_PAYOUT', 'MARKET_REFUND', 'ADMIN_ADJUSTMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "username" TEXT NOT NULL,
    "usernameLower" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'UPCOMING',
    "imageUrl" TEXT,
    "officialUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "MarketCategory" NOT NULL,
    "resolutionRules" TEXT NOT NULL,
    "resolutionSource" TEXT NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'DRAFT',
    "closeTime" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "winningOutcome" "MarketOutcome",
    "yesSharesOutstanding" INTEGER NOT NULL DEFAULT 0,
    "noSharesOutstanding" INTEGER NOT NULL DEFAULT 0,
    "liquidityParameter" INTEGER NOT NULL DEFAULT 1000,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcome" "MarketOutcome" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "averagePrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "yesShares" INTEGER NOT NULL DEFAULT 0,
    "noShares" INTEGER NOT NULL DEFAULT 0,
    "totalYesCost" INTEGER NOT NULL DEFAULT 0,
    "totalNoCost" INTEGER NOT NULL DEFAULT 0,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT,
    "purchaseId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcome" "MarketOutcome" NOT NULL,
    "settledByUserId" TEXT NOT NULL,
    "totalPayout" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameLower_key" ON "User"("usernameLower");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_slug_key" ON "Competition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Market_slug_key" ON "Market"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_marketId_key" ON "Position"("userId", "marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_marketId_key" ON "Settlement"("marketId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
