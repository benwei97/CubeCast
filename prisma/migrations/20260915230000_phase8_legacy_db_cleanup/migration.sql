-- DropForeignKey
ALTER TABLE "LedgerTransaction" DROP CONSTRAINT "LedgerTransaction_marketId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerTransaction" DROP CONSTRAINT "LedgerTransaction_purchaseId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerTransaction" DROP CONSTRAINT "LedgerTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_marketId_fkey";

-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_userId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_marketId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_userId_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_marketId_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_settledByUserId_fkey";

-- AlterTable
ALTER TABLE "Market" DROP COLUMN "liquidityParameter",
DROP COLUMN "noSharesOutstanding",
DROP COLUMN "winningOutcome",
DROP COLUMN "yesSharesOutstanding";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "balance";

-- DropTable
DROP TABLE "LedgerTransaction";

-- DropTable
DROP TABLE "Position";

-- DropTable
DROP TABLE "Purchase";

-- DropTable
DROP TABLE "Settlement";

-- DropEnum
DROP TYPE "MarketOutcome";

-- DropEnum
DROP TYPE "PositionStatus";

-- DropEnum
DROP TYPE "TransactionType";

