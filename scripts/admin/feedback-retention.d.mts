export const RETENTION_DAYS: number
export const SQL: string
export function runRetention(input: {
  connectionString: string
  storageDir: string
  limit?: number
  now?: Date
}): Promise<number>
