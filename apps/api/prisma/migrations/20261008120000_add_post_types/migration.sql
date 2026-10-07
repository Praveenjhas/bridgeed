-- Structured academic content: a post now carries a canonical PostType instead of
-- the single placeholder value TEXT.
--
-- PostgreSQL cannot remove a value from an enum, so the set is replaced rather
-- than altered. The new type is created first, every existing row is mapped onto
-- it, and only then is the old type dropped, which keeps this migration
-- non-destructive: no row is deleted, no column is dropped, and every existing
-- post id, comment and reaction is left exactly as it was. Every post written so
-- far was TEXT, which becomes DISCUSSION.

-- CreateEnum
CREATE TYPE "PostType_new" AS ENUM ('DISCUSSION', 'QUESTION', 'RESOURCE', 'ACHIEVEMENT', 'RESEARCH', 'ANNOUNCEMENT', 'OPPORTUNITY');

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "type" DROP DEFAULT;

-- AlterEnum
ALTER TABLE "Post" ALTER COLUMN "type" TYPE "PostType_new" USING (
    CASE "type"::text
        WHEN 'TEXT' THEN 'DISCUSSION'
        ELSE 'DISCUSSION'
    END
)::"PostType_new";

-- DropEnum
DROP TYPE "PostType";

-- RenameEnum
ALTER TYPE "PostType_new" RENAME TO "PostType";

-- SetDefault
ALTER TABLE "Post" ALTER COLUMN "type" SET DEFAULT 'DISCUSSION';
