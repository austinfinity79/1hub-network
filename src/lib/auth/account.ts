import { query } from '@/lib/db/client'

/** The sign-in address of an account, for that account's own screens only. */
export async function getAccountEmail(accountId: string): Promise<string | null> {
  const [account] = await query<{ email: string }>(
    'SELECT email FROM user_accounts WHERE id = $1',
    [accountId],
  )
  return account?.email ?? null
}
