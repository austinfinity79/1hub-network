/**
 * THAO-05 — the sort orders of the public directories (DEC-THAO-DIR), with
 * their address values (`?sap-xep=`). Pure: read by the pages on the server
 * and by the directory views in the browser.
 */

export type ProductSort = 'hoat-dong' | 'moi-nhat' | 'ten-a-z'
export const PRODUCT_SORTS: ReadonlyArray<{ key: ProductSort; label: string }> = [
  { key: 'hoat-dong', label: 'Hoạt động' },
  { key: 'moi-nhat', label: 'Mới nhất' },
  { key: 'ten-a-z', label: 'Tên A–Z' },
]

export type ProgrammeSort = 'sap-dien-ra' | 'moi-nhat' | 'ten-a-z'
export const PROGRAMME_SORTS: ReadonlyArray<{ key: ProgrammeSort; label: string }> = [
  { key: 'sap-dien-ra', label: 'Đang diễn ra' },
  { key: 'moi-nhat', label: 'Mới nhất' },
  { key: 'ten-a-z', label: 'Tên A–Z' },
]

export type ProblemSort = 'sap-het-han' | 'giai-thuong' | 'ten-a-z'
export const PROBLEM_SORTS: ReadonlyArray<{ key: ProblemSort; label: string }> = [
  { key: 'sap-het-han', label: 'Sắp hết hạn' },
  { key: 'giai-thuong', label: 'Giải thưởng cao nhất' },
  { key: 'ten-a-z', label: 'Tên A–Z' },
]

export type TalentSort = 'ten-a-z' | 'co-san-pham'
export const TALENT_SORTS: ReadonlyArray<{ key: TalentSort; label: string }> = [
  { key: 'ten-a-z', label: 'Tên A–Z' },
  { key: 'co-san-pham', label: 'Có sản phẩm' },
]

/** The requested order when it is one of `sorts`, else `fallback`. */
export function pickSort<T extends string>(
  value: string,
  sorts: ReadonlyArray<{ key: T }>,
  fallback: T,
): T {
  return sorts.find((s) => s.key === value)?.key ?? fallback
}
