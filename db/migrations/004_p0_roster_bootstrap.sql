-- 004_p0_roster_bootstrap.sql — WF01-REMEDIATION-01 (GAP-ROSTER).
--
-- Data Decisions Freeze D2 "PRESEED + PENDING FALLBACK": a known launch-roster
-- email that creates or signs in to an account gets its confirmed
-- CommunityMembership (ACTIVE) and, only when the roster row states it, its
-- LeadershipRecord (ACTIVE). Unknown users get nothing automatically.
--
-- ADDITIVE ONLY. The roster is stored in the existing membership_bootstrap
-- table (001); this migration adds:
--   1. uq_active_leadership — the database, not application code, guarantees
--      one ACTIVE leadership per (profile, organization, title), so a repeated
--      or concurrent bootstrap cannot duplicate it. Memberships are already
--      protected by uq_open_membership (002).
--   2. roster_reconcile_account(account) — the ONE attach routine, called at
--      sign-in by the app and after import by the roster CLI, so both apply
--      identical rules. It never creates a RoleAssignment: the approved
--      authorization matrix grants nothing from membership or leadership alone.

BEGIN;

CREATE UNIQUE INDEX uq_active_leadership
  ON leadership_records(profile_id, organization_id, role_label)
  WHERE state = 'ACTIVE';

-- Returns one row per pending bootstrap row it looked at:
--   ATTACHED            membership (and leadership if stated) now present; row consumed
--   ALREADY_ACTIVE      an ACTIVE membership already existed; leadership ensured; row consumed
--   CONFLICT_<STATE>    an existing non-ACTIVE membership (e.g. PENDING_APPROVAL,
--                       SUSPENDED) is NOT overwritten; row stays unconsumed for an operator
--
-- Concurrency: the pending rows are locked FOR UPDATE, so a second concurrent
-- caller waits, then finds them consumed and does nothing. The whole call is
-- one statement, hence one transaction: nothing is ever half-attached.
CREATE FUNCTION roster_reconcile_account(p_account uuid)
RETURNS TABLE (bootstrap_id uuid, organization_id uuid, outcome text)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
  v_email   text;
  v_profile uuid;
  v_state   membership_state;
  r         record;
BEGIN
  SELECT a.email_normalized INTO v_email
    FROM user_accounts a WHERE a.id = p_account AND a.status = 'ACTIVE';
  IF v_email IS NULL THEN
    RETURN;
  END IF;

  PERFORM 1 FROM membership_bootstrap b
   WHERE b.email_normalized = v_email AND b.consumed_at IS NULL
     AND b.membership_state = 'ACTIVE'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- The account's one profile (UNIQUE account_id); created DRAFT if absent.
  INSERT INTO individual_profiles (account_id) VALUES (p_account)
  ON CONFLICT (account_id) DO NOTHING;
  SELECT p.id INTO v_profile FROM individual_profiles p WHERE p.account_id = p_account;

  FOR r IN
    SELECT b.id, b.organization_id, b.leadership_role_label
      FROM membership_bootstrap b
     WHERE b.email_normalized = v_email AND b.consumed_at IS NULL
       AND b.membership_state = 'ACTIVE'
     ORDER BY b.created_at, b.id
  LOOP
    SELECT m.state INTO v_state
      FROM community_memberships m
     WHERE m.profile_id = v_profile AND m.organization_id = r.organization_id
     ORDER BY (m.state = 'ACTIVE') DESC, (m.state = 'PENDING_APPROVAL') DESC, m.updated_at DESC
     LIMIT 1;

    IF v_state IS NOT NULL AND v_state <> 'ACTIVE' THEN
      bootstrap_id := r.id;
      organization_id := r.organization_id;
      outcome := 'CONFLICT_' || v_state::text;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_state IS NULL THEN
      INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
      VALUES (v_profile, r.organization_id, 'ACTIVE', 'ORGANIZATION_VERIFIED', now());
    END IF;

    IF r.leadership_role_label IS NOT NULL THEN
      INSERT INTO leadership_records (profile_id, organization_id, role_label, state)
      VALUES (v_profile, r.organization_id, r.leadership_role_label, 'ACTIVE')
      ON CONFLICT (profile_id, organization_id, role_label) WHERE state = 'ACTIVE' DO NOTHING;
    END IF;

    UPDATE membership_bootstrap
       SET consumed_by_account_id = p_account, consumed_at = now()
     WHERE id = r.id;

    bootstrap_id := r.id;
    organization_id := r.organization_id;
    outcome := CASE WHEN v_state IS NULL THEN 'ATTACHED' ELSE 'ALREADY_ACTIVE' END;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMIT;
