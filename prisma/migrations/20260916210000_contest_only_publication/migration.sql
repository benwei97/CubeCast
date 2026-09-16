-- Undo legacy single-market publications without deleting markets or audit history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Market" m
    JOIN "ContestSlate" c ON c.id = m."slateId"
    WHERE c.status = 'DRAFT' AND m.status = 'OPEN'
      AND (
        EXISTS (SELECT 1 FROM "Prediction" p WHERE p."marketId" = m.id)
        OR EXISTS (SELECT 1 FROM "SettlementSnapshot" s WHERE s."marketId" = m.id)
      )
  ) THEN
    RAISE EXCEPTION 'A partially published draft contains picks or settlement evidence; review before unpublishing.';
  END IF;
END $$;

UPDATE "Market" m
SET status = 'DRAFT', "publishedAt" = NULL, "updatedAt" = NOW()
FROM "ContestSlate" c
WHERE c.id = m."slateId" AND c.status = 'DRAFT' AND m.status = 'OPEN';
