'use client'

import Image from 'next/image'
import { useState } from 'react'

import { ArrowRight, PublicAction } from '@/components/public-shell/public-action'

import styles from './about.module.css'

/**
 * DM02 / DM04 / DM05 "Humans of HUB" — three tabs (Thảo: HUB Tổng, HUB Khu
 * vực, Câu lạc bộ). People are the S1-UAT-08A workbook rows with their titles
 * as written; units and CLB counts are the canonical catalogue. Empty slots
 * the frame draws as "Họ tên — chờ cập nhật" are not drawn (DEMO-D8).
 * "Xem thành viên …" / "Tìm thành viên" go to the talent directory once it
 * ships (PUBLIC_ROUTES.talents), plain until then.
 */

export type HumanCard = {
  name: string
  title: string | null
  photo: string | null
  initials: string
}

export type HumansHubTong = {
  chair: HumanCard | null
  deputies: HumanCard[]
  advisors: HumanCard[]
  boards: Array<{ name: string; lead: HumanCard | null }>
}

export type HumansRegion = {
  slug: string
  short: string
  /** Catalogue name of the unit. */
  name: string
  place: string
  since: string
  clubCount: number
  chair: HumanCard | null
  deputies: HumanCard[]
  href: string
}

export type HumansClub = { hub: string; name: string; href: string }

type Tab = 'TONG' | 'KHU_VUC' | 'CLB'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'TONG', label: 'HUB Tổng' },
  { key: 'KHU_VUC', label: 'HUB Khu vực' },
  { key: 'CLB', label: 'Câu lạc bộ' },
]

function Face({
  person,
  size,
  className,
}: {
  person: HumanCard
  size: number
  className?: string
}) {
  return (
    <span className={className} aria-hidden="true">
      {person.photo ? (
        <Image src={person.photo} alt="" width={size} height={size} sizes={`${size}px`} />
      ) : (
        person.initials
      )}
    </span>
  )
}

function Person({ person, variant }: { person: HumanCard; variant: 'row' | 'compact' }) {
  return (
    <li className={variant === 'row' ? styles.leader : styles.leaderCompact}>
      <Face person={person} size={52} className={styles.leaderFace} />
      <div>
        <p className={styles.leaderName}>{person.name}</p>
        <p className={styles.leaderTitle}>{person.title ?? 'Chờ cập nhật'}</p>
        {variant === 'row' ? <p className={styles.leaderTerm}>Nhiệm kỳ hiện tại</p> : null}
      </div>
    </li>
  )
}

function HubTong({ data, talents }: { data: HumansHubTong; talents: string | null }) {
  return (
    <div data-humans-tab="TONG">
      <div className={styles.tabHead}>
        <div>
          <h3 className={styles.tabTitle}>HUB Tổng</h3>
          <p className={styles.tabLede}>Định hướng vận hành, kết nối nguồn lực, hạ tầng chung</p>
        </div>
        <PublicAction href={talents} className={styles.underlineLight}>
          Xem thành viên HUB Tổng <ArrowRight />
        </PublicAction>
      </div>
      {data.chair ? (
        <div className={styles.tree}>
          <p className={styles.treeLabel}>CHỦ TỊCH</p>
          <div className={styles.chair}>
            <Face person={data.chair} size={104} className={styles.chairFace} />
            <p className={styles.chairName}>{data.chair.name}</p>
            <p className={styles.chairTitle}>{data.chair.title}</p>
            <p className={styles.leaderTerm}>Nhiệm kỳ hiện tại</p>
          </div>
          <span className={styles.treeLine} aria-hidden="true" />
        </div>
      ) : null}
      <p className={styles.treeLabel}>PHÓ CHỦ TỊCH</p>
      <ul className={styles.leaderGrid} role="list">
        {data.deputies.map((p) => (
          <Person key={p.name} person={p} variant="row" />
        ))}
      </ul>
      {data.advisors.length ? (
        <>
          <p className={styles.treeLabel}>CỐ VẤN</p>
          <ul className={styles.leaderGrid} role="list">
            {data.advisors.map((p) => (
              <Person key={p.name} person={p} variant="row" />
            ))}
          </ul>
        </>
      ) : null}
      <p className={styles.treeLabel}>CÁC BAN CHUYÊN MÔN</p>
      <ul className={styles.boardGrid} role="list">
        {data.boards.map((b) => (
          <li key={b.name} className={styles.board}>
            <p className={styles.boardName}>{b.name}</p>
            {b.lead ? (
              <div className={styles.boardRow}>
                <Face person={b.lead} size={32} className={styles.boardFace} />
                <div>
                  <p className={styles.boardRole}>Trưởng ban</p>
                  <p className={styles.boardPerson}>{b.lead.name}</p>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Regions({ regions, domestic }: { regions: HumansRegion[]; domestic: string[] }) {
  const [slug, setSlug] = useState(regions[0]?.slug ?? null)
  const region = regions.find((r) => r.slug === slug) ?? regions[0]
  return (
    <div data-humans-tab="KHU_VUC">
      <h3 className={styles.tabTitle}>Cấu trúc HUB Khu vực</h3>
      <p className={styles.tabLede}>
        Cơ cấu linh hoạt theo quy mô, bối cảnh và nhu cầu của từng HUB Khu vực.
      </p>
      <div className={styles.structure}>
        <div className={styles.structureDomestic}>
          <p className={styles.structureLabel}>
            {['HUB KHU VỰC TRONG NƯỚC', ...domestic].join(' · ').toLocaleUpperCase('vi')}
          </p>
          <div className={styles.structureTop}>
            <span className={styles.structureChair}>Chủ tịch HUB Khu vực</span>
            <span className={styles.structureBoards}>
              <strong>Các Ban chuyên môn</strong>
              <small>Tổ chức theo quy mô, nhu cầu từng HUB</small>
            </span>
          </div>
          <ul className={styles.structureBranches} role="list">
            {[
              {
                name: 'HUB Business',
                text: 'Người trẻ đang làm việc tại doanh nghiệp, có tinh thần đổi mới sáng tạo và khởi nghiệp.',
                goal: 'Kết nối doanh nghiệp và bài toán tương ứng · Phát triển sáng kiến · Mở rộng cơ hội hợp tác',
              },
              {
                name: 'HUB University',
                text: 'Sinh viên, CLB khởi nghiệp và đổi mới sáng tạo tại các trường Đại học, Học viện.',
                goal: 'Phát hiện nhân tài, phát triển đội ngũ, kết nối các CLB thành viên',
              },
              {
                name: 'HUB High School',
                text: 'Học sinh THPT, CLB kinh doanh và khởi nghiệp trong trường cấp 3.',
                goal: '“Ươm mầm” tư duy đổi mới sáng tạo từ sớm',
              },
            ].map((b) => (
              <li key={b.name}>
                <span className={styles.structureVice}>
                  <small>Phó Chủ tịch</small>
                  {b.name}
                </span>
                <div className={styles.structureCard}>
                  <p>{b.text}</p>
                  <p className={styles.structureGoal}>{b.goal}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.structureAbroad}>
          <p className={styles.structureLabel}>HUB KHU VỰC QUỐC TẾ</p>
          <span className={styles.structureChair}>Chủ tịch HUB Khu vực</span>
          <span className={styles.structureVice}>
            <small>Phó Chủ tịch</small>
            Trưởng Ban chuyên môn
          </span>
          <div className={styles.structureCard}>
            <p className={styles.structureStrong}>Cộng đồng</p>
            <p className={styles.structureStrong}>Đối tác</p>
            <p className={styles.structureStrong}>Hoạt động tại quốc gia sở tại</p>
          </div>
        </div>
      </div>
      <div className={styles.regionChips} role="tablist" aria-label="HUB Khu vực">
        {regions.map((r) => (
          <button
            key={r.slug}
            type="button"
            role="tab"
            aria-selected={r.slug === region?.slug}
            className={`${styles.regionChip} ${r.slug === region?.slug ? styles.regionChipOn : ''}`}
            onClick={() => setSlug(r.slug)}
          >
            {r.short}
          </button>
        ))}
      </div>
      {region ? (
        <div className={styles.regionBoard} data-region={region.slug}>
          <div className={styles.tabHead}>
            <div>
              <h3 className={styles.regionTitle}>Ban điều hành {region.name}</h3>
              <p className={styles.tabLede}>
                {region.place} · từ {region.since} · {region.clubCount} CLB
              </p>
            </div>
            <PublicAction href={region.href} className={styles.underlineLight}>
              Chi tiết HUB Khu vực <ArrowRight />
            </PublicAction>
          </div>
          {region.chair ? (
            <div className={styles.regionTree}>
              <div className={styles.regionChair}>
                <Face person={region.chair} size={40} className={styles.boardFace} />
                <div>
                  <p className={styles.leaderName}>{region.chair.name}</p>
                  <p className={styles.leaderTitle}>{region.chair.title}</p>
                </div>
              </div>
              {region.deputies.length ? (
                <ul className={styles.regionDeputies} role="list">
                  {region.deputies.map((p) => (
                    <Person key={p.name} person={p} variant="compact" />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className={styles.tabLede}>Ban điều hành đang được cập nhật.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Clubs({ clubs, total }: { clubs: HumansClub[]; total: number }) {
  const [all, setAll] = useState(false)
  const shown = all ? clubs : clubs.slice(0, 6)
  return (
    <div data-humans-tab="CLB">
      <div className={styles.tabHead}>
        <div>
          <h3 className={styles.tabTitle}>Câu lạc bộ, cộng đồng</h3>
          <p className={styles.tabLede}>{total} câu lạc bộ trực thuộc các HUB Chapter</p>
        </div>
        <button
          type="button"
          className={styles.underlineLight}
          aria-expanded={all}
          onClick={() => setAll((v) => !v)}
        >
          {all ? 'Thu gọn' : 'Xem tất cả câu lạc bộ'} <ArrowRight />
        </button>
      </div>
      <ul className={styles.clubGrid} role="list">
        {shown.map((c) => (
          <li key={`${c.hub}-${c.name}`} className={styles.clubBig}>
            <p className={styles.clubHub}>{c.hub.toLocaleUpperCase('vi')}</p>
            <p className={styles.clubBigName}>
              <PublicAction href={c.href} className={styles.unitLink}>
                {c.name}
              </PublicAction>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AboutHumans({
  hubTong,
  regions,
  domestic,
  clubs,
  clubTotal,
  talents,
}: {
  hubTong: HumansHubTong
  regions: HumansRegion[]
  domestic: string[]
  clubs: HumansClub[]
  clubTotal: number
  talents: string | null
}) {
  const [tab, setTab] = useState<Tab>('TONG')
  return (
    <>
      <div className={styles.humansTabs} role="tablist" aria-label="Humans of HUB">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.humansTab} ${tab === t.key ? styles.humansTabOn : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'TONG' ? <HubTong data={hubTong} talents={talents} /> : null}
      {tab === 'KHU_VUC' ? <Regions regions={regions} domestic={domestic} /> : null}
      {tab === 'CLB' ? <Clubs clubs={clubs} total={clubTotal} /> : null}
    </>
  )
}
