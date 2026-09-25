import { mkdirSync, openSync, readFileSync, readSync, closeSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { PNG } from 'pngjs'

import { assertWritable } from './paths'

export type Size = { width: number; height: number }

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * Reads PNG dimensions from the IHDR chunk without decoding pixels, so a
 * manifest audit over every reference stays cheap.
 */
export function readPngSize(file: string): Size {
  const fd = openSync(file, 'r')
  try {
    const head = Buffer.alloc(24)
    const read = readSync(fd, head, 0, 24, 0)
    if (read < 24 || !head.subarray(0, 8).equals(SIGNATURE)) {
      throw new Error(`not a PNG file: ${file}`)
    }
    if (head.toString('ascii', 12, 16) !== 'IHDR') {
      throw new Error(`PNG has no leading IHDR chunk: ${file}`)
    }
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) }
  } finally {
    closeSync(fd)
  }
}

export function decodePng(buffer: Buffer): PNG {
  return PNG.sync.read(buffer)
}

export function readPng(file: string): PNG {
  return decodePng(readFileSync(file))
}

/** Writes a PNG through the path policy; design-reference/ is never a target. */
export function writePng(file: string, png: PNG): void {
  assertWritable(file)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, PNG.sync.write(png))
}

export function writeBuffer(file: string, data: Buffer | string): void {
  assertWritable(file)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, data)
}
