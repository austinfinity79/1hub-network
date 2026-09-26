-- 005_p0_purpose_step_completion.sql — WF01-REMEDIATION-03A (DEC-WF01-RESUME-D1).
--
-- `primary_intent IS NULL` has two legitimate meanings: WF01-S05 never
-- completed, or completed with "Bỏ qua, làm sau" (DEC-WF01-S05-D3). Resume
-- logic must tell them apart without inference, so completion of the Purpose
-- step is recorded explicitly. The server sets it once (intent saved OR step
-- skipped) and never takes it from the client.
--
-- ADDITIVE ONLY. Existing rows stay NULL: no backfill is guessed from later
-- profile or consent data.

BEGIN;

ALTER TABLE individual_profiles ADD COLUMN purpose_step_completed_at timestamptz NULL;

COMMIT;
