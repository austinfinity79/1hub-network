-- 018_p0_password_auth.sql — S1-UAT-01 username/email + password + Google auth
-- (Sprint 1 UAT pack, Appendix B "Quyết định đã áp dụng"; feedback.md "Các điểm
-- lệch khác cần dev nắm": the live /auth used magic link, the approved design
-- uses username/email + password and Google. Magic link is kept, not removed
-- (migration 001's auth_magic_link_requests is untouched), so this is additive.
--
-- Only what the Sprint1 contract needs, and WHY:
--
--   user_accounts.username              4-30 chars, unaccented letters/digits/
--     + username_normalized             dot, case-insensitive unique (Appendix
--                                        B "Tên tài khoản"). `username` keeps
--                                        the casing the user typed (or Google's
--                                        auto-generated form); `_normalized` is
--                                        the lowercase column the UNIQUE index
--                                        and every lookup use, exactly the
--                                        email/email_normalized pattern already
--                                        on this table. Nullable: a pre-S1-UAT-01
--                                        magic-link account has none until it
--                                        signs in again and one is generated.
--   user_accounts.password_hash         Null for a Google-only account that
--                                        never set a password (US-01.05 "Tài
--                                        khoản tạo bằng Google chưa có mật
--                                        khẩu"). Never the plaintext, per
--                                        CLAUDE.md section 4.
--   user_accounts.failed_password_*     Server-enforced lockout (Appendix B
--     + password_locked_until           "Mật khẩu"): 5 wrong attempts suspends
--                                        password sign-in for 15 minutes. Lives
--                                        on the account row, like `status`,
--                                        because it is account-level sign-in
--                                        state, not a session or a profile
--                                        field (CLAUDE.md section 3: account,
--                                        profile, identity verification are
--                                        separate concerns; this is the first
--                                        one). Google sign-in does not read or
--                                        clear it: ACCOUNT STATUS stays the only
--                                        thing that can block Google (US-01.05,
--                                        task section 6).
--
--   user_accounts.signup_full_name      "Họ và tên" typed at sign-up, or the
--                                        Google profile name (US-01.02 / US-01.05:
--                                        "được điền sẵn vào Bước 1"). An account
--                                        hint, NOT the profile: writing it into
--                                        individual_profiles.full_name would mark
--                                        onboarding as started and skip the ACC-05
--                                        intro the new account must see. Stage 1
--                                        only uses it as the initial value while
--                                        the profile's own full_name is empty.
--
--   auth_identities                     One row per linked external provider
--     + uq_auth_identities_provider_sub (Google only in Sprint 1; `provider` is
--     + uq_auth_identities_account_prov an enum so a second provider is additive
--                                        later, never a column rename). Mirrors
--                                        the existing one-table-per-concern
--                                        shape (auth_magic_link_requests,
--                                        user_sessions) rather than overloading
--                                        user_accounts with a bare google_sub
--                                        column: linking by email (task section
--                                        9) is "the SAME account", and a
--                                        separate table is what keeps that an
--                                        addition instead of a second identity
--                                        model. `email_at_link` is kept for
--                                        audit only, never for lookup (lookup is
--                                        always `provider_subject`, Google's
--                                        stable `sub`, not the mutable e-mail).
--
--   password_reset_requests             Same shape as auth_magic_link_requests
--     + idx_password_reset_account      (token_hash, 15-minute expiry, single
--                                        use) but keyed to account_id, not an
--                                        e-mail string: unlike a magic-link
--                                        sign-in, the account already exists
--                                        when a reset is requested, and a
--                                        dedicated table (rather than reusing
--                                        auth_magic_link_requests) keeps the
--                                        two token lifecycles — one creates a
--                                        session, the other only unlocks a
--                                        password change — from ever being
--                                        confusable by a shared `token_hash`
--                                        namespace.
--
-- Not added here, and why: no CHECK constraint on username/password shape
-- (the email column has none either; shape is enforced once, in
-- src/lib/auth/username.ts and password.ts, matching src/lib/auth/email.ts).
-- No new account_status value: lock-by-failed-attempts is time-windowed and
-- password-login-only, not the existing BLOCKED/DEACTIVATED admin action
-- (ADMIN-PROD-05, PD-7), which still fully overrides it (task section 6).
--
-- ROLLBACK (manual, never automatic; refuses unless every new structure is
-- empty, so it is lossless or does nothing; exercised by
-- src/lib/auth/password-auth-migration.db-test.ts).
--   BEGIN;
--   DO $$ BEGIN
--     IF EXISTS (SELECT 1 FROM auth_identities)
--        OR EXISTS (SELECT 1 FROM password_reset_requests)
--        OR EXISTS (SELECT 1 FROM user_accounts
--                    WHERE username IS NOT NULL OR username_normalized IS NOT NULL
--                       OR password_hash IS NOT NULL OR signup_full_name IS NOT NULL
--                       OR failed_password_attempts <> 0 OR password_locked_until IS NOT NULL) THEN
--       RAISE EXCEPTION '018 rollback refused: password auth data exists';
--     END IF;
--   END $$;
--   DROP TABLE password_reset_requests;
--   DROP TABLE auth_identities;
--   DROP TYPE auth_identity_provider;
--   DROP INDEX uq_user_accounts_username_normalized;
--   ALTER TABLE user_accounts DROP COLUMN signup_full_name, DROP COLUMN password_locked_until,
--     DROP COLUMN failed_password_attempts, DROP COLUMN password_hash,
--     DROP COLUMN username_normalized, DROP COLUMN username;
--   DELETE FROM schema_migrations WHERE filename = '018_p0_password_auth.sql';
--   COMMIT;

BEGIN;

ALTER TABLE user_accounts
  ADD COLUMN username text,
  ADD COLUMN username_normalized text,
  ADD COLUMN password_hash text,
  ADD COLUMN failed_password_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN password_locked_until timestamptz,
  ADD COLUMN signup_full_name text;

CREATE UNIQUE INDEX uq_user_accounts_username_normalized
  ON user_accounts (username_normalized) WHERE username_normalized IS NOT NULL;

CREATE TYPE auth_identity_provider AS ENUM ('GOOGLE');

CREATE TABLE auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  provider auth_identity_provider NOT NULL,
  provider_subject text NOT NULL,
  email_at_link text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_auth_identities_provider_sub UNIQUE (provider, provider_subject),
  CONSTRAINT uq_auth_identities_account_prov UNIQUE (account_id, provider)
);

CREATE TABLE password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  request_ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_reset_account_created
  ON password_reset_requests(account_id, created_at DESC);

COMMIT;
