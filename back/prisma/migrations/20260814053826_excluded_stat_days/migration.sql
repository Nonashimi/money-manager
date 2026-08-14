-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "excludedStatDays" TEXT[] DEFAULT ARRAY[]::TEXT[];
