-- 013_p0_applications.sql — TASK 24.4 L5 Startup Journey (DEC-L5, DEC-2809-D6).
--
-- A founder's application to a programme persists on the server: saved as a
-- DRAFT, resumed on any device, submitted once, read-only afterwards.
--
--   programme_application_forms what a PUBLISHED programme accepts: applicant
--                               types and its configured question set, each
--                               question with a form step (1–4). Read-only in
--                               Alpha; the WF04 operator demo stays a browser
--                               demo (DEC-2909-L4H2).
--   applications                one application of one canonical venture
--                               (projects) to one programme. It stores only the
--                               programme-specific answers; the venture is
--                               referenced, never copied, until the submit
--                               snapshot freezes what was sent.
--
-- The one-active-pair index, the SUBMITTED check and the trigger enforce in the
-- database what the service already refuses (defence in depth).
--
-- ADDITIVE. New types and tables only; no existing column, type or row changes.
-- Rollback: drop `applications`, `programme_application_forms`, `application_status`
-- and `applicant_type`.

BEGIN;

CREATE TYPE application_status AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE applicant_type AS ENUM ('TEAM', 'STARTUP');

CREATE TABLE programme_application_forms (
  programme_id uuid PRIMARY KEY REFERENCES programmes(id),
  applicant_types applicant_type[] NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_programme_application_forms_types CHECK (cardinality(applicant_types) > 0),
  CONSTRAINT ck_programme_application_forms_questions CHECK (jsonb_typeof(questions) = 'array'),
  CONSTRAINT ck_programme_application_forms_version CHECK (version > 0)
);

CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES programmes(id),
  venture_id uuid NOT NULL REFERENCES projects(id),
  primary_applicant_type applicant_type NOT NULL,
  status application_status NOT NULL DEFAULT 'DRAFT',
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  question_set_version integer NOT NULL,
  created_by_account_id uuid NOT NULL REFERENCES user_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  submitted_by_account_id uuid REFERENCES user_accounts(id),
  snapshot jsonb,
  CONSTRAINT ck_applications_answers CHECK (jsonb_typeof(answers) = 'array'),
  CONSTRAINT ck_applications_submitted CHECK (
    (status = 'SUBMITTED') = (
      submitted_at IS NOT NULL AND submitted_by_account_id IS NOT NULL AND snapshot IS NOT NULL
    )
  )
);

-- One active application per (venture, programme). Later statuses (withdrawn,
-- …) are added additively and fall outside this index.
CREATE UNIQUE INDEX uq_applications_active_pair
  ON applications (venture_id, programme_id)
  WHERE status IN ('DRAFT', 'SUBMITTED');
CREATE INDEX idx_applications_programme ON applications (programme_id, status);

CREATE FUNCTION applications_refuse_submitted_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'SUBMITTED' THEN
    RAISE EXCEPTION 'a SUBMITTED application is final (DEC-L5-D2)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_applications_submitted_final
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION applications_refuse_submitted_update();

COMMIT;
