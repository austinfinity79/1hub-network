import type { Page } from '@playwright/test'

/**
 * ADMIN-PROD-08 — the layout-safety detector shared by the Admin layout spec
 * (and anything that needs to prove the detector catches a real defect).
 */

/** Layout findings for the current page; an empty list means safe. */
export async function layoutFindings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const main = document.querySelector('main')!
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const label = (el: Element) =>
      `${el.tagName.toLowerCase()}[${(el.textContent ?? '').trim().slice(0, 24)}]`
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth)
      out.push('page overflows horizontally')
    // Tables: the head is one left-to-right line; every data row (each later
    // child of the table) has the head's cell count, aligned under its header.
    for (const table of main.querySelectorAll('[role="table"], [data-queue] > div')) {
      const head = table.querySelector(':scope > [role="row"]')
      if (!head) continue
      const headers = [...head.querySelectorAll(':scope > [role="columnheader"]')]
      if (headers.length === 0) continue
      const boxes = headers.map((h) => h.getBoundingClientRect())
      // Vertical centres: an empty (action) header has no height but sits on the line.
      const mid = (r: DOMRect) => (r.top + r.bottom) / 2
      for (const [i, h] of headers.entries()) {
        if (boxes[i]!.width < 32) out.push(`column collapsed: ${label(h)}`)
        if (h.scrollWidth > h.clientWidth + 1) out.push(`header clipped: ${label(h)}`)
        if (Math.abs(mid(boxes[i]!) - mid(boxes[0]!)) > 2)
          out.push(`header off its line: ${label(h)}`)
        if (i > 0 && boxes[i]!.left <= boxes[i - 1]!.left)
          out.push(`header out of order: ${label(h)}`)
      }
      const rows = [...table.children].filter((c) => c !== head && c.children.length > 0)
      for (const row of rows) {
        const cells = [...row.children].filter((c) => !c.matches('[data-revoke-confirm]'))
        if (cells.length !== headers.length) {
          out.push(`row has ${cells.length}/${headers.length} cells: ${label(row)}`)
          continue
        }
        for (const [i, cell] of cells.entries())
          if (Math.abs(cell.getBoundingClientRect().left - boxes[i]!.left) > 2)
            out.push(`cell ${i + 1} not under its header: ${label(row)}`)
      }
    }
    // Labels, titles, eyebrows, chips and buttons never clip (table cells may ellipsize).
    for (const el of main.querySelectorAll('h1, h2, label, button, a, [class*="chip"]')) {
      if (!visible(el) || el.closest('[role="cell"]')) continue
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible')
        out.push(`text clipped: ${label(el)}`)
    }
    // Form fields stay inside their card.
    for (const el of main.querySelectorAll('input, select, textarea')) {
      const card = el.closest('section, form')
      if (!card || !visible(el)) continue
      if (el.getBoundingClientRect().right > card.getBoundingClientRect().right + 1)
        out.push(`field overflows its card: ${label(el)}`)
    }
    return out
  })
}
