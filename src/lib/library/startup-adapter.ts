/**
 * TASK 22-PREVIEW-LIBRARY-FIX — read-only adapter for the public startup
 * directory `https://startup.1hub.cloud/data/startup.json` (DEC-L15-D7).
 *
 * The remote file is external, untrusted input. This module turns it into the
 * Library's own view model and nothing in the UI reads a remote field name:
 *
 *   ten_startup                  → LibraryStartup.name (required; record dropped without it)
 *   san_pham_chinh               → product (search only, DEC-L15-D13)
 *   mo_ta_ngan                   → tagline
 *   linh_vuc[] (free text)       → domains (as written) + categories (filter taxonomy)
 *   giai_doan_phat_trien         → stage (known values only, else null)
 *   website                      → website (http/https only, else null)
 *   thanh_vien[].ho_ten/vai_tro  → founders (founder roles only; name, role, startup) and the
 *                                  startup's founderNames (search only, DEC-L15-D13)
 *   thanh_vien.length            → memberCount
 *
 * Not read: mo_ta_chi_tiet, chuong_trinh_tung_tham_gia,
 * thanh_vien[].don_vi_lam_viec_hoc_tap and .kinh_nghiem_thanh_tich_khac (personal
 * detail). Every kept string is trimmed, length-capped and stripped of e-mail
 * addresses and phone numbers; a member whose name carries contact data is
 * left out entirely. Pure functions: no I/O here (see startup-source.ts).
 */

export type Category =
  'LOGISTICS' | 'FINTECH' | 'HEALTH' | 'AGRI' | 'EDU' | 'AI' | 'ENV' | 'IT' | 'OTHER'

export type StartupStage = 'Ideation' | 'Prototype' | 'MVP' | 'Growth' | 'Scale-up'

export type LibraryStartup = {
  id: string
  name: string
  tagline: string | null
  /** Main product; search only. */
  product: string | null
  /** Founder names; search only. */
  founderNames: string[]
  domains: string[]
  categories: Category[]
  stage: StartupStage | null
  website: string | null
  memberCount: number
}

export type LibraryFounder = {
  id: string
  name: string
  role: string
  startups: Array<{ name: string; website: string | null; stage: StartupStage | null }>
  categories: Category[]
}

export type StartupDirectory =
  { status: 'ok'; startups: LibraryStartup[]; founders: LibraryFounder[] } | { status: 'error' }

export const STAGES: StartupStage[] = ['Ideation', 'Prototype', 'MVP', 'Growth', 'Scale-up']

export const MAX_RECORDS = 1000

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const PHONE = /(?:\+?84|0)[\s.-]?\d(?:[\s.-]?\d){7,10}/g

/** Accent- and case-insensitive form, for matching and ids. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

const hasContact = (text: string) => new RegExp(EMAIL).test(text) || new RegExp(PHONE).test(text)

/** Trimmed, contact-free, single-spaced text of at most `max` characters, or null. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value
    .replace(EMAIL, '')
    .replace(PHONE, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** An absolute http(s) URL without credentials, or null. */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.') || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

const CATEGORY_RULES: Array<[Category, RegExp]> = [
  ['LOGISTICS', /logistic|giao thong|van tai|giao hang|chuoi cung ung/],
  ['FINTECH', /fintech|tai chinh|insurtech|blockchain|crypto|web3|thanh toan|defi|depin/],
  ['HEALTH', /medical|health|y te|than kinh|tu ky|neuro/],
  ['AGRI', /agri|nong nghiep|lam nghiep/],
  ['EDU', /edtech|ed-tech|giao duc|campus/],
  ['AI', /(^|[^a-z])ai([^a-z]|$)|tri tue nhan tao|robot/],
  ['ENV', /environment|moi truong|nang luong|esg|vat lieu/],
  ['IT', /cntt|du lieu|data|cong nghe thong tin|hi-tech|gpu|do hoa|computer/],
]

/** Filter categories of one free-text domain list; OTHER when nothing matches. */
export function categorise(domains: string[]): Category[] {
  const out = new Set<Category>()
  for (const d of domains) {
    const f = fold(d)
    for (const [cat, rule] of CATEGORY_RULES) if (rule.test(f)) out.add(cat)
  }
  if (out.size === 0) out.add('OTHER')
  return [...out]
}

function splitDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string') continue
    for (const part of raw.split(',')) {
      const text = cleanText(part, 60)
      if (text && !seen.has(fold(text))) {
        seen.add(fold(text))
        out.push(text)
      }
    }
  }
  return out.slice(0, 4)
}

function stageOf(value: unknown): StartupStage | null {
  if (typeof value !== 'string') return null
  const f = fold(value)
  return STAGES.find((s) => fold(s) === f) ?? null
}

const slug = (text: string) =>
  fold(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'x'

const isFounderRole = (role: string) => /found|sang lap/.test(fold(role))

/** Validates and normalises the remote payload. Throws when it is not a list. */
export function adaptStartups(payload: unknown): {
  startups: LibraryStartup[]
  founders: LibraryFounder[]
} {
  if (!Array.isArray(payload)) throw new Error('startup.json is not a list')
  const startups: LibraryStartup[] = []
  const founders = new Map<string, LibraryFounder>()
  const ids = new Set<string>()

  for (const record of payload.slice(0, MAX_RECORDS)) {
    if (!record || typeof record !== 'object') continue
    const r = record as Record<string, unknown>
    const name = cleanText(r.ten_startup, 80)
    if (!name || hasContact(String(r.ten_startup))) continue
    let id = slug(name)
    for (let n = 2; ids.has(id); n++) id = `${slug(name)}-${n}`
    ids.add(id)
    const domains = splitDomains(r.linh_vuc)
    const members = Array.isArray(r.thanh_vien) ? r.thanh_vien : []
    const startup: LibraryStartup = {
      id,
      name,
      tagline: cleanText(r.mo_ta_ngan, 200),
      product: cleanText(r.san_pham_chinh, 120),
      founderNames: [],
      domains,
      categories: categorise(domains),
      stage: stageOf(r.giai_doan_phat_trien),
      website: safeUrl(r.website),
      memberCount: members.length,
    }
    startups.push(startup)

    for (const m of members) {
      if (!m || typeof m !== 'object') continue
      const raw = (m as Record<string, unknown>).ho_ten
      const roleRaw = (m as Record<string, unknown>).vai_tro
      if (typeof raw !== 'string' || hasContact(raw)) continue
      const person = cleanText(raw, 60)
      const role = cleanText(roleRaw, 80)
      if (!person || !role || !isFounderRole(role) || !/\p{L}/u.test(person)) continue
      const key = fold(person)
      const found = founders.get(key)
      if (!startup.founderNames.includes(person)) startup.founderNames.push(person)
      const link = { name: startup.name, website: startup.website, stage: startup.stage }
      if (found) {
        if (!found.startups.some((s) => s.name === link.name)) found.startups.push(link)
        found.categories = [...new Set([...found.categories, ...startup.categories])]
      } else {
        founders.set(key, {
          id: slug(person),
          name: person,
          role,
          startups: [link],
          categories: [...startup.categories],
        })
      }
    }
  }
  return { startups, founders: [...founders.values()] }
}
