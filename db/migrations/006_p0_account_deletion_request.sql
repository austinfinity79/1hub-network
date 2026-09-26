-- 006_p0_account_deletion_request.sql — WF02-S07, DB gap P13 (deletion subset).
--
-- DEC-WF02-S07-G1/G2: request storage ONLY. One canonical account-deletion
-- request per account (UNIQUE account_id). No status, processing, retention,
-- grace period, cancellation, reason or metadata: no deletion workflow is
-- frozen. A request never deletes or deactivates anything by itself.
--
-- ADDITIVE ONLY. No existing table or row changes.

BEGIN;

CREATE TABLE account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES user_accounts(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_account_deletion_request_account UNIQUE (account_id)
);

COMMIT;
