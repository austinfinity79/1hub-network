import { query } from '@/lib/db/client'

/** The sign-in address of an account, for that account's own screens only. */
export async function getAccountEmail(accountId: string): Promise<string | null> {
  const [account] = await query<{ email: string }>(
    'SELECT email FROM user_accounts WHERE id = $1',
    [accountId],
  )
  return account?.email ?? null
}

/**
 * S1-UAT-01: the name given at sign-up (password form or Google profile), used
 * only to prefill stage 1 while the profile has no full name of its own.
 */
export async function getAccountSignupName(accountId: string): Promise<string | null> {
  const [account] = await query<{ signup_full_name: string | null }>(
    'SELECT signup_full_name FROM user_accounts WHERE id = $1',
    [accountId],
  )
  return account?.signup_full_name ?? null
}
