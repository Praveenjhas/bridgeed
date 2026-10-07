-- Auth foundation: harden the account model and give refresh tokens a home.
--
-- Nothing here drops a table or deletes a row. The two statements Prisma would
-- have generated as failing rewrites on existing data (narrowing UserRole and
-- adding a NOT NULL University.slug) carry an explicit, lossless mapping.

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- AlterEnum
-- STUDENT/MENTOR/EDUCATOR were never authorisation roles: mentor and educator
-- standing belongs to the profile, and being a student is implied by having a
-- StudentProfile. The narrowed enum keeps ADMIN and folds every other value
-- into USER, so an account loses no ability it actually had.
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (CASE WHEN "role"::text = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- AlterTable
-- `slug` is required and unique, so existing rows are backfilled from `name`
-- before NOT NULL is applied instead of the column being added as NOT NULL.
ALTER TABLE "University" ADD COLUMN "slug" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3);

UPDATE "University"
SET "slug" = COALESCE(
  NULLIF(
    TRIM(BOTH '-' FROM REGEXP_REPLACE(
      LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g')),
      '-{2,}', '-', 'g'
    )),
    ''
  ),
  'university'
);

-- Names are not unique, so a repeated slug stays with its earliest owner and
-- the rest are suffixed in creation order. A collision would abort this whole
-- migration (it runs in a transaction), never silently overwrite a value.
WITH ranked AS (
  SELECT "id",
         "slug",
         ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "createdAt", "id") AS position
  FROM "University"
)
UPDATE "University" AS university
SET "slug" = LEFT(ranked."slug", 70) || '-' || ranked.position
FROM ranked
WHERE university."id" = ranked."id"
  AND ranked.position > 1;

ALTER TABLE "University" ALTER COLUMN "slug" SET NOT NULL;

-- A university that was already verified gets the moment `verifiedAt` implies.
UPDATE "University" SET "verifiedAt" = "updatedAt" WHERE "verified" IS TRUE;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "passwordUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "role" SET DEFAULT 'USER';

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "StudentProfile_universityId_idx" ON "StudentProfile"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "University_slug_key" ON "University"("slug");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
