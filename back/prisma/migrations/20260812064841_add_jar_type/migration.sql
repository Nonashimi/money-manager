-- CreateEnum
CREATE TYPE "JarType" AS ENUM ('SPENDING', 'SAVINGS');

-- AlterTable
ALTER TABLE "Jar" ADD COLUMN     "type" "JarType" NOT NULL DEFAULT 'SPENDING';
