-- 003_p0_idempotency_store.sql
--
-- Durable idempotency key store for M0-T10.
--
-- 001_p0_init.sql and 002_p0_schema_alignment.sql are NOT modified. This
-- migration is additive and introduces exactly one table and one enum.
--
-- WHY A NEW TABLE RATHER THAN REUSING AN EXISTING ONE:
--
-- The storage audit examined all 28 tables. None can host idempotency without
-- changing its meaning:
--
--   audit_events              an append-only record of what happened. An
--                             idempotency claim is a concurrency lock that must
--                             be read back and mutated; writing locks into the
--                             audit trail would make the trail lie.
--   analytics_events          an append-only measurement stream, no uniqueness
--                             and no response storage.
--   user_sessions             one row per authenticated session. Idempotency is
--                             required on an UNAUTHENTICATED operation
--                             (auth magic-link request, 05:56), so a session row
--                             cannot exist yet.
--   auth_magic_link_requests  one row per issued link, keyed by token_hash. It
--                             has no operation column and no response storage,
--                             and overloading it would couple a cross-cutting
--                             API concern to one auth flow.
--
-- 002_p0_schema_alignment.sql:22 already recorded "idempotency key store" as a
-- missing structure deferred to its own decision. This is that structure.
--
-- WHAT THE FROZEN CONTRACT DOES AND DOES NOT SAY:
--
-- 05_API_CONTRACT_P0_v1.0.md:48-63 requires the client to send an
-- `Idempotency-Key` header on seven operation classes. It specifies NOTHING
-- else: no storage shape, no retention window, no replay semantics, no conflict
-- error code. Everything below that line is therefore a PROVISIONAL TECHNICAL
-- CONFIGURATION chosen to be the smallest implementation that is safe, and is
-- recorded as such in docs/implementation/IDEMPOTENCY_STORE_P0.md. None of it is
-- presented as an approved contract value.

BEGIN;

-- Dedicated enum rather than extending the shared record_state, following the
-- precedent set by 002: shared lifecycle domains are not polluted with
-- per-entity states. Two states only, because the transaction model below makes
-- a FAILED state unreachable.
CREATE TYPE idempotency_state AS ENUM ('PROCESSING','COMPLETED');

CREATE TABLE idempotency_keys (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The opaque client-supplied key, 05:53. Stored verbatim; it is an identifier
  -- chosen by the client, not a secret and not a credential.
  idempotency_key     text NOT NULL,

  -- Which operation class the key was presented against, from the seven at
  -- 05:56-63. Scoping by operation stops a key issued for one operation from
  -- suppressing a different one.
  operation           text NOT NULL,

  -- The authenticated actor, or NULL for an unauthenticated operation such as
  -- the magic-link request. Part of the uniqueness scope, which is what stops
  -- actor B replaying actor A's stored result.
  actor_account_id    uuid REFERENCES user_accounts(id) ON DELETE CASCADE,

  -- sha256 of the canonicalised request input. A HASH, never the payload: the
  -- store must not accumulate a second copy of personal data, and a hash is
  -- sufficient to detect a key reused with different content.
  request_fingerprint text NOT NULL,

  state               idempotency_state NOT NULL DEFAULT 'PROCESSING',

  -- The outcome to replay. Only the body already sent on the wire is stored, so
  -- no secret enters this table: the magic-link response carries no token, by
  -- construction in src/lib/auth/magic-link.ts.
  response_status     integer,
  response_body       jsonb,

  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  expires_at          timestamptz NOT NULL,

  -- UNIQUE NULLS NOT DISTINCT (PostgreSQL 15+) is load-bearing. Under the
  -- default NULLS DISTINCT, every unauthenticated request would carry a NULL
  -- actor, every NULL would be considered different, and the constraint would
  -- never fire on exactly the operation the contract requires it for.
  CONSTRAINT idempotency_keys_scope_uniq
    UNIQUE NULLS NOT DISTINCT (idempotency_key, operation, actor_account_id),

  -- A COMPLETED row must carry a replayable outcome and a PROCESSING row must
  -- not. This makes a half-written record impossible to store rather than
  -- something the application has to remember to check.
  CONSTRAINT idempotency_keys_state_shape CHECK (
    (state = 'PROCESSING'
      AND response_status IS NULL AND response_body IS NULL AND completed_at IS NULL)
    OR
    (state = 'COMPLETED'
      AND response_status IS NOT NULL AND response_body IS NOT NULL AND completed_at IS NOT NULL)
  ),

  CONSTRAINT idempotency_keys_key_not_blank CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  CONSTRAINT idempotency_keys_expiry_after_creation CHECK (expires_at > created_at)
);

-- Retention sweep support. The only query that scans without the unique key.
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

COMMENT ON TABLE idempotency_keys IS
  'M0-T10 durable idempotency store. Claim, replay and conflict detection for the seven operation classes at 05_API_CONTRACT_P0_v1.0.md:56-63. Retention window and conflict semantics are PROVISIONAL: the frozen contract specifies the header only.';

COMMENT ON COLUMN idempotency_keys.request_fingerprint IS
  'sha256 of the canonicalised request input. Never the payload itself.';

COMMENT ON COLUMN idempotency_keys.actor_account_id IS
  'NULL for unauthenticated operations. Part of the uniqueness scope so one actor cannot replay another actor stored result.';

COMMIT;
