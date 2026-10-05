import { assertIsolatedTestDatabase } from './db-test-target'

// DB-SAFETY-01: runs before every DB test file; a refusal stops the suite before it connects.
assertIsolatedTestDatabase(process.env)
