-- Session lookups: revoking every session a user still has (sign-out-all) and
-- revoking a whole rotation chain both filter on `revokedAt IS NULL` next to
-- their key column, so the user index carries that column. `familyId` keeps its
-- single-column index because a chain is only a handful of rows, and `expiresAt`
-- is read from the row already located by `refreshTokenHash`.
--
-- Additive and lossless: no table is rewritten or dropped and no row is touched.

-- DropIndex
DROP INDEX "Session_userId_idx";

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
