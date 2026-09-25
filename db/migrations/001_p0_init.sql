BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_status AS ENUM ('ACTIVE','BLOCKED','DEACTIVATED');
CREATE TYPE profile_status AS ENUM ('DRAFT','ACTIVE','INACTIVE');
CREATE TYPE org_type AS ENUM ('HUB','CHAPTER','CLB','COMPANY','FUND','PARTNER');
CREATE TYPE record_state AS ENUM ('PENDING_APPROVAL','ACTIVE','REJECTED','CLOSED');
CREATE TYPE project_type AS ENUM ('PROJECT','STARTUP');
CREATE TYPE project_status AS ENUM ('DRAFT','ACTIVE','ARCHIVED');
CREATE TYPE programme_type AS ENUM ('PROGRAMME','CHALLENGE');
CREATE TYPE publication_status AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE consent_type AS ENUM ('TERMS_ACCEPTANCE','PRIVACY_DATA_PROCESSING');
CREATE TYPE visibility_level AS ENUM ('PUBLIC','NETWORK_ONLY','PROGRAMME_ACCESS','GRANTED_ACCESS','PRIVATE');
CREATE TYPE vocab_status AS ENUM ('ACTIVE','ARCHIVED');
CREATE TYPE feedback_status AS ENUM ('NEW','REVIEWED','CLOSED');

CREATE TABLE user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text NOT NULL UNIQUE,
  status account_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE auth_magic_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  request_ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_magic_link_email_created ON auth_magic_link_requests(email_normalized, created_at DESC);

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_account ON user_sessions(account_id, expires_at DESC);

CREATE TABLE individual_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES user_accounts(id) ON DELETE CASCADE,
  status profile_status NOT NULL DEFAULT 'DRAFT',
  display_name text,
  avatar_asset_id text,
  headline text,
  region_vocab_id uuid,
  bio text,
  development_goal text,
  current_need text,
  no_experience_yet boolean NOT NULL DEFAULT false,
  primary_intent text,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vocabulary_types (
  code text PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vocabulary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code text NOT NULL REFERENCES vocabulary_types(code),
  slug text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status vocab_status NOT NULL DEFAULT 'ACTIVE',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(type_code, slug)
);
CREATE INDEX idx_vocab_type_status ON vocabulary_items(type_code, status, sort_order);
ALTER TABLE individual_profiles ADD CONSTRAINT fk_profile_region FOREIGN KEY (region_vocab_id) REFERENCES vocabulary_items(id);

CREATE TABLE profile_domains (
  profile_id uuid NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  vocab_id uuid NOT NULL REFERENCES vocabulary_items(id),
  PRIMARY KEY(profile_id, vocab_id)
);
CREATE TABLE profile_skills (
  profile_id uuid NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  vocab_id uuid NOT NULL REFERENCES vocabulary_items(id),
  PRIMARY KEY(profile_id, vocab_id)
);
CREATE TABLE profile_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  organization_name text,
  started_on date,
  ended_on date,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE profile_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  institution text NOT NULL,
  programme text,
  started_on date,
  ended_on date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE profile_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  label text,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile_visibility_settings (
  profile_id uuid PRIMARY KEY REFERENCES individual_profiles(id) ON DELETE CASCADE,
  default_level visibility_level NOT NULL DEFAULT 'NETWORK_ONLY',
  group_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type consent_type NOT NULL,
  version text NOT NULL,
  title text NOT NULL,
  content_uri text NOT NULL,
  effective_at timestamptz NOT NULL,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_type, version)
);

CREATE TABLE consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  consent_type consent_type NOT NULL,
  legal_document_id uuid NOT NULL REFERENCES legal_documents(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, consent_type, legal_document_id)
);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type org_type NOT NULL,
  parent_id uuid REFERENCES organizations(id),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  logo_asset_id text,
  status publication_status NOT NULL DEFAULT 'DRAFT',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_type_status ON organizations(type, status);
CREATE INDEX idx_org_parent ON organizations(parent_id);

CREATE TABLE organization_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_org_id uuid NOT NULL REFERENCES organizations(id),
  target_org_id uuid NOT NULL REFERENCES organizations(id),
  relationship_type text NOT NULL,
  state record_state NOT NULL DEFAULT 'ACTIVE',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(source_org_id <> target_org_id)
);
CREATE INDEX idx_org_rel_source ON organization_relationships(source_org_id, state);
CREATE INDEX idx_org_rel_target ON organization_relationships(target_org_id, state);

CREATE TABLE community_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  state record_state NOT NULL DEFAULT 'PENDING_APPROVAL',
  source text NOT NULL DEFAULT 'SELF_DECLARED',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_open_membership ON community_memberships(profile_id, organization_id) WHERE state IN ('PENDING_APPROVAL','ACTIVE');
CREATE INDEX idx_membership_org_state ON community_memberships(organization_id, state);

CREATE TABLE leadership_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  role_label text NOT NULL,
  state record_state NOT NULL DEFAULT 'ACTIVE',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leadership_org_state ON leadership_records(organization_id, state);

CREATE TABLE role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  role_code text NOT NULL,
  scope_type text NOT NULL,
  scope_id uuid,
  state record_state NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX idx_role_actor_scope ON role_assignments(account_id, role_code, state);

CREATE TABLE membership_bootstrap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  membership_state record_state NOT NULL DEFAULT 'ACTIVE',
  leadership_role_label text,
  consumed_by_account_id uuid REFERENCES user_accounts(id),
  consumed_at timestamptz,
  source_batch text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email_normalized, organization_id, source_batch)
);
CREATE INDEX idx_bootstrap_email ON membership_bootstrap(email_normalized, consumed_at);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type project_type NOT NULL DEFAULT 'PROJECT',
  owner_profile_id uuid NOT NULL REFERENCES individual_profiles(id),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  summary text,
  status project_status NOT NULL DEFAULT 'DRAFT',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_owner_status ON projects(owner_profile_id, status);

CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES individual_profiles(id),
  role_label text,
  state record_state NOT NULL DEFAULT 'ACTIVE',
  joined_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE UNIQUE INDEX uq_open_project_member ON project_members(project_id, profile_id) WHERE state='ACTIVE';

CREATE TABLE programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  programme_type programme_type NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  summary text,
  status publication_status NOT NULL DEFAULT 'DRAFT',
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_programmes_org_status ON programmes(organization_id, status);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  programme_id uuid REFERENCES programmes(id),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  summary text,
  status publication_status NOT NULL DEFAULT 'DRAFT',
  starts_at timestamptz,
  ends_at timestamptz,
  location_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_org_time ON events(organization_id, starts_at DESC);
CREATE INDEX idx_events_programme ON events(programme_id, starts_at DESC);

CREATE TABLE feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES user_accounts(id),
  profile_id uuid REFERENCES individual_profiles(id),
  body text NOT NULL,
  status feedback_status NOT NULL DEFAULT 'NEW',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX idx_feedback_status_created ON feedback_submissions(status, created_at DESC);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id uuid REFERENCES user_accounts(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_resource ON audit_events(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_events(actor_account_id, created_at DESC);

CREATE TABLE analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES user_accounts(id),
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_name_time ON analytics_events(event_name, occurred_at DESC);

COMMIT;
