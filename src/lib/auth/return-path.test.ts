import { describe, expect, it } from 'vitest'

import {
  RETURN_PATH_MAX_AGE_MS,
  RETURN_PATH_STORAGE_KEY,
  authWithReturn,
  readReturnPath,
  rememberReturnPath,
  safeReturnPath,
  takeReturnPath,
} from './return-path'

function memory() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

describe('return path after sign-in (BD-02 return-to rule)', () => {
  it('accepts only same-origin relative paths outside auth and API', () => {
    expect(safeReturnPath('/projects/new')).toBe('/projects/new')
    expect(safeReturnPath('/library?q=AI#top')).toBe('/library?q=AI#top')
    for (const bad of [
      null,
      undefined,
      '',
      'projects/new',
      '//evil.example/x',
      '/\\evil.example',
      'https://evil.example/',
      'javascript:alert(1)',
      '/ok path',
      '/auth',
      '/auth/callback?token=x',
      '/api/v1/me',
      `/${'a'.repeat(600)}`,
    ]) {
      expect(safeReturnPath(bad), String(bad)).toBeNull()
    }
  })

  it('builds the sign-in entry with the encoded path', () => {
    expect(authWithReturn('/projects/new')).toBe('/auth?redirect=%2Fprojects%2Fnew')
  })

  it('keeps a path for an hour and reads it once', () => {
    const s = memory()
    rememberReturnPath(s, '/projects/new', 1_000)
    expect(readReturnPath(s, 2_000)).toBe('/projects/new')
    expect(takeReturnPath(s, 2_000)).toBe('/projects/new')
    expect(takeReturnPath(s, 2_000)).toBeNull()

    rememberReturnPath(s, '/projects/new', 1_000)
    expect(readReturnPath(s, 1_000 + RETURN_PATH_MAX_AGE_MS + 1)).toBeNull()
    rememberReturnPath(s, null)
    expect(s.map.has(RETURN_PATH_STORAGE_KEY)).toBe(false)
  })

  it('ignores a tampered or malformed stored value', () => {
    const s = memory()
    s.setItem(RETURN_PATH_STORAGE_KEY, JSON.stringify({ path: '//evil.example', at: 1 }))
    expect(readReturnPath(s, 2)).toBeNull()
    s.setItem(RETURN_PATH_STORAGE_KEY, '{not json')
    expect(readReturnPath(s, 2)).toBeNull()
    s.setItem(RETURN_PATH_STORAGE_KEY, JSON.stringify({ path: '/me', at: 10 }))
    expect(readReturnPath(s, 5)).toBeNull()
  })

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    }
    expect(() => rememberReturnPath(broken, '/projects/new')).not.toThrow()
    expect(takeReturnPath(broken)).toBeNull()
  })
})
