-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "sourceJarId" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_sourceJarId_fkey" FOREIGN KEY ("sourceJarId") REFERENCES "Jar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
