import dataset from './dir-bai-toan.json'
import { adaptProblems, type LibraryProblem } from './problem-adapter'

/**
 * LIBRARY DATA UPDATE — the "Bài toán" records for /library, read on the
 * server from the supplied dataset shipped with the app. Replacing
 * `dir-bai-toan.json` with a newer export updates the tab; the count, facets
 * and chips all derive from it.
 */
export const LIBRARY_PROBLEMS: LibraryProblem[] = adaptProblems(dataset)
