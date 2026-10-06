/**
 * DEMO-0710 — read-only presentation fixture of the demo ventures
 * (docs/demo-0710/DEMO_DATA_CONTRACT.md). Keyed by the canonical venture ids
 * that `db/seed/demo_0710.sql` creates; the canonical row (name, summary,
 * stage, region, domains, team) always comes from the database, this file
 * only adds what has no canonical field yet. Server-side only. DEMO STATE
 * ONLY: nothing here is a funding, metric or award record.
 */

export type DemoVenturePresentation = {
  /** One-line pitch of the homepage rows (DM01 "Sản phẩm theo ngành"). */
  short: string
  /** Funding round as drawn ("Seed", "Pre-seed"). */
  round: string | null
  /** Status chip of the homepage rows. */
  badge: 'GỌI VỐN' | 'THẮNG GIẢI' | null
  /** Listed in "Startup sẵn sàng gặp nhà đầu tư" (DM01). */
  investorReady: boolean
  /** Headline numbers of the investor card, as drawn for Tracely (DM01 / DM10). */
  headline: Array<{ value: string; label: string }>
  /** DM08 hero counter "có khách hàng trả phí" (DM10: paid pilot contract). */
  payingCustomers: boolean
  /** DM08 hero counter "trong danh mục iHUB Ventures" (DM10 "Danh mục iHUB Ventures"). */
  portfolio: string | null
  /** DM10 "Từ 2025". */
  since: string | null
}

/** The `DEMO` marker: one place to find and remove every demo-only value. */
export const DEMO = 'DEMO-0710' as const

export const DEMO_VENTURES: Readonly<Record<string, DemoVenturePresentation>> = {
  // Tracely (tracely)
  'de710000-0000-0000-0000-0000000000c1': {
    short: 'Truy vết hao hụt chặng giao cuối',
    round: 'Seed',
    badge: 'GỌI VỐN',
    investorReady: true,
    headline: [
      { value: '1,2 triệu', label: 'kiện truy vết/quý' },
      { value: '-33%', label: 'hao hụt' },
      { value: '6', label: 'bưu cục dùng' },
    ],
    payingCustomers: true,
    portfolio: 'iHUB Ventures',
    since: '2025',
  },
  // AgriTrace (agritrace)
  'de710000-0000-0000-0000-0000000000c2': {
    short: 'Nhật ký canh tác số cho hợp tác xã',
    round: null,
    badge: null,
    investorReady: false,
    headline: [],
    payingCustomers: false,
    portfolio: null,
    since: null,
  },
  // Kho Lạnh Miền Tây (kho-lanh-mien-tay)
  'de710000-0000-0000-0000-0000000000c3': {
    short: 'Kho lạnh chia sẻ thuê theo giờ',
    round: null,
    badge: null,
    investorReady: false,
    headline: [],
    payingCustomers: true,
    portfolio: null,
    since: null,
  },
}

export function demoVenture(ventureId: string): DemoVenturePresentation | null {
  return DEMO_VENTURES[ventureId] ?? null
}
