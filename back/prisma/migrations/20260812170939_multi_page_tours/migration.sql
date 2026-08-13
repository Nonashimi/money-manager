-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "onboardingCompletedAt",
ADD COLUMN     "seenTours" TEXT[] DEFAULT ARRAY[]::TEXT[];
