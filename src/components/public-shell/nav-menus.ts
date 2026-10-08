import { ECOSYSTEM_LINKS, PUBLIC_ROUTES } from '@/lib/public/routes'

/**
 * S2-NAV-DROPDOWN-V2-01 — the 11 menu entries of Feedback Sprint 2 lần 3, as
 * the Figma components draw them ("Nav / Menu xổ · Giới thiệu · VI" 881:4401,
 * "· Chương trình · VI" 763:4100; the EN components carry the English copy,
 * shown only by an EN version — this product is VI only, so no EN string is
 * rendered next to a VI one). Codes G.02a–g, G.02i–j, G.03a–b.
 *
 * Kinds: `page` (same tab), `anchor` (a section of a page, shareable hash),
 * `external` (↗, new tab, noopener noreferrer), `none` (no destination yet:
 * shown, never an active link). iHUB Incubator (G.02f) is hidden until it has
 * a destination (NAV-DD).
 */

export type NavItemKind = 'page' | 'anchor' | 'external' | 'none'

export type NavItem = {
  code: string
  label: string
  description: string | null
  kind: NavItemKind
  href: string | null
  hidden?: boolean
}

export type NavGroup = { title: string | null; tint: boolean; items: NavItem[] }

/** The About sections the menu points at (shareable hashes). */
export const ABOUT_ANCHORS = { map: 'ban-do', humans: 'humans-of-hub' } as const

/** "Hơn {n} CLB": the real count, floored to the ten below (47 → 40); null below 10. */
export function clubsDescription(count: number | null | undefined): string | null {
  if (count == null || count < 10) return null
  return `Hơn ${Math.floor(count / 10) * 10} CLB trong mạng lưới`
}

const page = (href: string | null): Pick<NavItem, 'kind' | 'href'> =>
  href ? { kind: 'page', href } : { kind: 'none', href: null }
const external = (href: string | null): Pick<NavItem, 'kind' | 'href'> =>
  href ? { kind: 'external', href } : { kind: 'none', href: null }

export function aboutMenu(clubCount: number | null | undefined): NavGroup[] {
  const about = PUBLIC_ROUTES.about
  return [
    {
      title: 'HUB NETWORK',
      tint: false,
      items: [
        {
          code: 'G.02a',
          label: 'Về HUB Network',
          description: 'Sứ mệnh, giá trị và dấu ấn phát triển',
          ...page(about),
        },
        {
          code: 'G.02b',
          label: 'Bản đồ HUB Khu vực',
          description: 'HUB trong nước và quốc tế',
          ...(about
            ? { kind: 'anchor' as const, href: `${about}#${ABOUT_ANCHORS.map}` }
            : page(null)),
        },
        {
          code: 'G.02c',
          label: 'Humans of HUB',
          description: 'Những người đang dẫn dắt mạng lưới',
          ...(about
            ? { kind: 'anchor' as const, href: `${about}#${ABOUT_ANCHORS.humans}` }
            : page(null)),
        },
        // CLB1 (club list) is not built: shown without a link.
        {
          code: 'G.02d',
          label: 'Câu lạc bộ',
          description: clubsDescription(clubCount),
          ...page(null),
        },
      ],
    },
    {
      title: 'HỆ SINH THÁI',
      tint: true,
      items: [
        {
          code: 'G.02e',
          label: '1Hub',
          description: 'Xác thực · định danh cá nhân',
          ...external(ECOSYSTEM_LINKS.oneHub),
        },
        {
          code: 'G.02f',
          label: 'iHUB Incubator',
          description: 'Đào tạo, ươm tạo đội ngũ startup',
          ...external(ECOSYSTEM_LINKS.ihubIncubator),
          hidden: !ECOSYSTEM_LINKS.ihubIncubator,
        },
        {
          code: 'G.02g',
          label: 'iHUB Ventures',
          description: 'Quỹ đầu tư giai đoạn đầu',
          ...external(ECOSYSTEM_LINKS.ihubVentures),
        },
        {
          code: 'G.02i',
          label: 'VNV',
          description: 'Quỹ đầu tư giai đoạn tăng trưởng',
          ...external(ECOSYSTEM_LINKS.vnv),
        },
        // RC1 (portfolio) is not built: shown without a link.
        {
          code: 'G.02j',
          label: 'Danh mục đầu tư',
          description: 'Startup đã được đầu tư trong hệ sinh thái',
          ...page(null),
        },
      ],
    },
  ]
}

export const PROGRAMME_MENU: NavGroup[] = [
  {
    title: null,
    tint: false,
    items: [
      {
        code: 'G.03a',
        label: 'Chương trình',
        description: 'Thử thách, bài toán và giải thưởng đang mở',
        ...page(PUBLIC_ROUTES.programmes),
      },
      {
        code: 'G.03b',
        label: 'Sự kiện',
        description: 'Lịch sự kiện của HUB và các HUB Khu vực',
        ...page(PUBLIC_ROUTES.events),
      },
    ],
  },
]
