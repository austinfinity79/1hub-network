import { expect, test, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { auditRevision, topOf } from '../pixel-qa/revision'
import { applyVocabularyFixture, completedAccount } from '../support/onboarding'
import {
  BOARD_PROFILE,
  boardVentures,
  freshAddress,
  invite,
  inviteFromAgriLink,
} from '../support/workspace'

/**
 * WF02 L2 realignment — pixel audits against the L2 board (DEC-L2R-D11),
 * 1440×900 DPR1, production build. Every capture is new; no evidence of the
 * earlier WF02 screens is reused.
 *
 * The board persona is prepared through the real APIs (support/workspace.ts).
 * Each block is compared at its own anchor, since the product leaves out what
 * has no source (D-P1, D-V1, D-V2) and the blocks below move up. Excluded
 * regions are the documented intentional differences, listed per audit.
 */

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.afterAll(async () => {
  await closePool()
})

const at = (page: Page, anchor: string) => topOf(page, `[data-anchor="${anchor}"]`)

async function boardMember(page: Page) {
  return completedAccount(page.request, 'l2-board', BOARD_PROFILE)
}

test.describe('WF02-S08 ME7 pixel QA', () => {
  test('1440×900: header, sidebar, heading, draft card and invitation match ME7', async ({
    page,
    browser,
  }) => {
    const me = await boardMember(page)
    const { kho } = await boardVentures(page.request)
    await invite(page.request, kho.id, {
      email: freshAddress('tuan'),
      role_label: 'Co-founder',
      permission: 'EDIT',
    })
    await inviteFromAgriLink(browser, me.email)
    await page.goto('/projects', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-venture]')).toHaveCount(2)
    const card = await topOf(page, `[data-venture="${kho.id}"]`)
    const banner = await at(page, 'invitation')

    await auditRevision(page, {
      name: 'WF02-S08.ME7',
      reference: 'design-reference/final/revision/L2/ME7__projects__SOURCE.png',
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 65 }, dy: 0 },
        { name: 'sidebar', reference: { x: 110, y: 95, width: 240, height: 215 }, dy: 0 },
        { name: 'head', reference: { x: 360, y: 95, width: 980, height: 110 }, dy: 0 },
        {
          name: 'draft-card',
          reference: { x: 365, y: 428, width: 975, height: 128 },
          dy: card - 434,
        },
        {
          name: 'invitation',
          reference: { x: 365, y: 650, width: 975, height: 92 },
          dy: banner - 656,
        },
      ],
      exclude: await page.evaluate(() =>
        [
          // The member's name in the header is the persona's, the board's is another.
          ...document.querySelectorAll('[data-frame="projects"] header > div:last-child'),
          // Facts: the board counts submissions and "Hồ sơ n/48" (L5, D-V2).
          ...document.querySelectorAll('[data-venture] p:last-child'),
          // The permission chip: the board draws it on its first card only.
          ...document.querySelectorAll('[data-venture] [data-kind="permission"]'),
        ].map((el) => {
          const r = el.getBoundingClientRect()
          return { x: r.x - 2, y: r.y + scrollY - 2, width: r.width + 4, height: r.height + 4 }
        }),
      ),
      intentional: [
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            '"Tạo từ SUB0", the thin-profile note, submissions and "Hồ sơ n/48 trường" belong to L5 or have no definition (D-V2); frame codes (PRO1, PRJ2, L44 SP1) are annotations',
        },
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'no venture is public (D-V1): every card is the draft card; the viewer’s level is shown on each card',
        },
        {
          class: 'INTENTIONAL-COPY',
          reason: 'the lede leaves out "kể cả đội tạo nhanh lúc nộp bài" (SUB0 is L5)',
        },
      ],
    })
  })
})

/** Capture-space rectangles of every element matching `selectors`. */
async function rects(page: Page, selectors: string[]) {
  return page.evaluate(
    (list) =>
      list.flatMap((selector) =>
        [...document.querySelectorAll(selector)].map((el) => {
          const r = el.getBoundingClientRect()
          return { x: r.x - 2, y: r.y + scrollY - 2, width: r.width + 4, height: r.height + 4 }
        }),
      ),
    selectors,
  )
}

test.describe('WF02-S01 FP1-OWN pixel QA', () => {
  test('1440×900: header, banner, identity, suggestions and the profile sections match FP1-OWN', async ({
    page,
  }) => {
    await boardMember(page)
    await boardVentures(page.request)
    await page.goto('/me', { waitUntil: 'networkidle' })
    const button = await topOf(page, '[data-nav="profile-edit"]')

    await auditRevision(page, {
      name: 'WF02-S01.FP1-OWN',
      reference: 'design-reference/final/revision/L2/FP1-OWN__my-profile__SOURCE.png',
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 60 }, dy: 0 },
        { name: 'banner', reference: { x: 0, y: 60, width: 1440, height: 62 }, dy: 0 },
        {
          name: 'identity',
          reference: { x: 120, y: 145, width: 828, height: 420 },
          dy: 0,
        },
        // The first button and the card's end; "Mở với" and "Tài nguyên" are not drawn.
        {
          name: 'identity-action',
          reference: { x: 120, y: 775, width: 225, height: 79 },
          dy: button - 785,
        },
        {
          name: 'identity-end',
          reference: { x: 740, y: 775, width: 208, height: 79 },
          dy: button - 785,
        },
        // Title and the completion line; the bar's fill is the server's percent (D-C1).
        {
          name: 'suggest-head',
          reference: { x: 120, y: 870, width: 828, height: 58 },
          dy: (await at(page, 'suggest')) - 870,
        },
        {
          name: 'suggest-text',
          reference: { x: 120, y: 948, width: 828, height: 32 },
          dy: (await at(page, 'suggest')) - 870,
        },
        {
          name: 'about',
          reference: { x: 120, y: 1383, width: 828, height: 151 },
          dy: (await at(page, 'about')) - 1383,
        },
        {
          name: 'experience',
          reference: { x: 120, y: 1551, width: 828, height: 125 },
          dy: (await at(page, 'experience')) - 1551,
        },
        {
          name: 'education',
          reference: { x: 120, y: 2394, width: 828, height: 200 },
          dy: (await at(page, 'education')) - 2394,
        },
        {
          name: 'expertise-head',
          reference: { x: 120, y: 2665, width: 828, height: 72 },
          dy: (await at(page, 'expertise')) - 2665,
        },
      ],
      exclude: [
        // The member in the header is the persona; the board's is another person.
        { x: 1100, y: 0, width: 340, height: 60 },
        // The banner's second sentence and "Xem như Guest" (no other viewer exists).
        { x: 270, y: 60, width: 930, height: 61 },
        // "Hồ sơ đã duyệt" (no review of a person's profile exists).
        { x: 348, y: 458, width: 110, height: 36 },
        // The line under the headline: the board names a HUB position the persona has not.
        ...(await rects(page, ['[data-anchor="identity"] p:has(> button)'])),
        // "Mở với" and "Tài nguyên" (no source).
        { x: 340, y: button - 4, width: 400, height: 52 },
        // The completion bar and line: the server's percent and count (D-C1).
        ...(await rects(page, [
          '[data-anchor="suggest"] [role="progressbar"]',
          '[data-anchor="suggest"] [role="progressbar"] + p',
        ])),
        // Experience: the board adds employment type, place and a second line.
        ...(await rects(page, ['[data-record="experience"] p:nth-child(n+2)'])),
        // Education: the second school's initials and note.
        ...(await rects(page, [
          '[data-record="education"]:nth-child(2) span',
          '[data-record="education"]:nth-child(2) p:last-child',
        ])),
      ],
      intentional: [
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'D-P1: badges, activity counts, "Ai đang xem hồ sơ", "Dự án trên HUB", "Tiến trình phát triển", certificates, public URL, "Xem như Guest", "Mở với", "Tài nguyên" have no source and are not drawn; the blocks below move up and are compared at their own anchors',
        },
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'no other member can open this page yet (FP1 is not built), so the banner keeps its first sentences only; the right column lists the member’s ventures instead of one public startup card',
        },
        {
          class: 'INTENTIONAL-BUSINESS',
          reason: 'completion is the frozen ten groups (D-C1); suggestion cards carry no claims',
        },
      ],
    })
  })

  test('1440×900: the experience dialog matches L12', async ({ page }) => {
    await boardMember(page)
    await page.goto('/me', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Sửa kinh nghiệm' }).click()
    await page.getByRole('button', { name: 'Sửa Đồng sáng lập · CEO' }).click()
    const dialog = page.locator('dialog[data-dialog="experience"]')
    await expect(dialog).toBeVisible()
    // The values L12 draws (not saved): its period and its bulleted description.
    await dialog.getByLabel('Từ').fill('02/2026')
    await dialog
      .getByLabel('Mô tả')
      .fill(
        '· Dẫn đội 6 người, sản phẩm truy xuất nguồn gốc cho HTX nông sản\n· Đang làm bài toán 03 và 07 của challenge Nông sản ĐBSCL',
      )
    // The board draws the dialog at rest: no focus ring on the control last used.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    const top = Math.round((await dialog.boundingBox())!.y)
    const from = await topOf(page, 'dialog[data-dialog="experience"] input[name="started_on"]')

    await auditRevision(page, {
      name: 'WF02-S01.L12',
      reference: 'design-reference/final/revision/L2/L12__experience-dialog__SOURCE.png',
      segments: [
        { name: 'head', reference: { x: 380, y: 115, width: 680, height: 160 }, dy: top - 115 },
        {
          name: 'period-to-footer',
          reference: { x: 380, y: 492, width: 680, height: 353 },
          dy: from - 517,
        },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'D-P1: "Có trên HUB · tự liên kết" (linking an organisation profile) has no source; the organisation is a text field',
        },
      ],
    })
  })
})

test.describe('WF02-S05 PRJ1–PRJ3 pixel QA', () => {
  test('1440×900: PRJ1 matches L13a', async ({ page }) => {
    await boardMember(page)
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: /Dự án \/ ý tưởng/ }).check({ force: true })
    await page.locator('#ve-name').fill('Kho lạnh chia sẻ')
    const picker = page.locator('[aria-controls="ve-domain-list"]')
    await picker.click()
    await page.getByRole('button', { name: 'Logistics', exact: true }).click()
    await page.getByRole('button', { name: 'AgriTech', exact: true }).click()
    await picker.click()
    await page
      .locator('#ve-summary')
      .fill('Chia sẻ kho lạnh theo giờ cho hộ kinh doanh nông sản nhỏ')
    await page.getByRole('radio', { name: 'Ý tưởng', exact: true }).check({ force: true })
    // Anchors are read in page coordinates, with the page at its top.
    await page.evaluate(() => window.scrollTo(0, 0))
    const name = await topOf(page, '#ve-name')
    const segments = await topOf(page, '[data-anchor="stage"] [role="radiogroup"]')
    const roles = await topOf(page, '[data-anchor="role"] [role="radiogroup"]')
    const footer = await topOf(
      page,
      '[data-step-form="info"] > div:last-child, form[data-step-form="info"] > div:last-child',
    )

    await auditRevision(page, {
      name: 'WF02-S05.PRJ1',
      reference: 'design-reference/final/revision/L2/L13a__project-create-core__SOURCE.png',
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 65 }, dy: 0 },
        { name: 'card-head', reference: { x: 300, y: 93, width: 840, height: 312 }, dy: 0 },
        { name: 'ai', reference: { x: 330, y: 420, width: 780, height: 115 }, dy: 0 },
        {
          name: 'fields',
          reference: { x: 341, y: 600, width: 758, height: 336 },
          dy: name - 630,
        },
        {
          name: 'stage',
          reference: { x: 330, y: 960, width: 780, height: 80 },
          dy: segments - 991,
        },
        {
          name: 'role',
          reference: { x: 330, y: 1060, width: 780, height: 95 },
          dy: roles - 1090,
        },
        {
          name: 'footer',
          reference: { x: 300, y: 1170, width: 840, height: 100 },
          dy: footer - 1178,
        },
      ],
      exclude: await rects(page, [
        // The startup card's second sentence and the type note (the type is fixed, G4).
        '[data-step-form="info"] [role="radiogroup"] label:nth-child(2) span span:last-child',
        '[data-step-form="info"] > div:nth-of-type(1) > p:last-of-type',
        // The AI body's rule code (BR-ONB-01) is an annotation.
        '[data-ai-block] p:last-child',
      ]),
      intentional: [
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'the dashed box’s label "BA TRƯỜNG DÙNG CHUNG VỚI SUB0 → L37 · SUB0" is a flow annotation (SUB0 is L5); the fields are compared at their own anchor',
        },
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'G4: the type is fixed once created, so the note says so instead of "Đổi được sau" and the startup card promises no extra fields',
        },
        {
          class: 'INTENTIONAL-SCOPE',
          reason: 'D-A1: the AI block is drawn and inert; the rule code of its body is not shown',
        },
      ],
    })
  })

  test('1440×900: PRJ2 matches L13b', async ({ page }) => {
    await boardMember(page)
    const { kho } = await boardVentures(page.request)
    await invite(page.request, kho.id, {
      email: freshAddress('tuan.le'),
      role_label: 'Co-founder',
      permission: 'EDIT',
    })
    await invite(page.request, kho.id, {
      email: freshAddress('thao.nguyen'),
      role_label: 'Thành viên',
      permission: 'VIEW',
    })
    await page.goto(`/projects/new?venture=${kho.id}&step=team`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-team-table] li')).toHaveCount(3)
    const team = await at(page, 'team')
    const levels = await at(page, 'levels')
    const footer = await topOf(page, '[data-step-form="team"] > div:last-child')

    await auditRevision(page, {
      name: 'WF02-S05.PRJ2',
      reference: 'design-reference/final/revision/L2/L13b__project-create-team__SOURCE.png',
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 65 }, dy: 0 },
        { name: 'head', reference: { x: 300, y: 93, width: 840, height: 160 }, dy: 0 },
        { name: 'invite', reference: { x: 330, y: 255, width: 780, height: 95 }, dy: 0 },
        { name: 'link', reference: { x: 330, y: 345, width: 780, height: 100 }, dy: 0 },
        // The team head, the avatars and the chips; the person column differs by
        // design (a pending row shows the address alone, the owner row no e-mail).
        {
          name: 'team-head',
          reference: { x: 330, y: 455, width: 780, height: 30 },
          dy: team - 464,
        },
        {
          name: 'team-avatars',
          reference: { x: 330, y: 485, width: 55, height: 192 },
          dy: team - 464,
        },
        {
          name: 'team-chips',
          reference: { x: 740, y: 485, width: 370, height: 192 },
          dy: team - 464,
        },
        {
          name: 'levels',
          reference: { x: 330, y: 695, width: 780, height: 125 },
          dy: levels - 701,
        },
        {
          name: 'footer',
          reference: { x: 300, y: 870, width: 840, height: 100 },
          dy: footer - 877,
        },
      ],
      exclude: [
        // The link row's address: invitation by link is not defined (D-T1).
        { x: 390, y: 360, width: 520, height: 50 },
        // A person's column: a pending row shows the address alone (whether it has an
        // account is never said), and the owner row carries no e-mail line.
        ...(await page.evaluate(() =>
          [...document.querySelectorAll('[data-team-table] li')].map((li) => {
            const r = li.getBoundingClientRect()
            return { x: 385, y: r.y + scrollY, width: 340, height: r.height }
          }),
        )),
        // What each level may do: the board adds submissions and ownership transfer.
        ...(await rects(page, ['[data-anchor="levels"] li'])),
      ],
      intentional: [
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'D-T1: the link row is drawn and inert, with no address; the fourth line of the levels box names NOTI1 and FP1-OWN / ME7 and is not shown',
        },
        {
          class: 'INTENTIONAL-PRIVACY',
          reason:
            'inviting reveals nothing about an address: a pending row shows the address alone, never a name or "Chưa có tài khoản HUB"; the owner row shows no e-mail',
        },
        {
          class: 'INTENTIONAL-PRIVACY',
          reason:
            'the address field’s placeholder uses the reserved example.com domain instead of a gmail.com address that could be a real person’s',
        },
      ],
    })
  })

  test('1440×900: PRJ3 matches L13c', async ({ page }) => {
    await boardMember(page)
    const { kho } = await boardVentures(page.request)
    await invite(page.request, kho.id, { email: freshAddress('tuan.le'), permission: 'EDIT' })
    await invite(page.request, kho.id, { email: freshAddress('thao.nguyen') })
    await page.goto(`/projects/new?venture=${kho.id}&step=done`, { waitUntil: 'networkidle' })
    const card = await topOf(page, '[data-next="edit"]')

    await auditRevision(page, {
      name: 'WF02-S05.PRJ3',
      reference: 'design-reference/final/revision/L2/L13c__project-create-done__SOURCE.png',
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 65 }, dy: 0 },
        { name: 'head', reference: { x: 300, y: 91, width: 840, height: 242 }, dy: 0 },
        {
          name: 'next',
          reference: { x: 330, y: 377, width: 780, height: 125 },
          dy: card - 385,
        },
      ],
      exclude: await rects(page, [
        // The chips after the status: the board adds "Hồ sơ 6/48 trường" (D-V2).
        '[data-step-form="done"] p:nth-of-type(1) span:nth-child(n+3)',
        // The next card's text: the board promises review and publication (D-V1).
        '[data-next="edit"] > div',
      ]),
      intentional: [
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'D-V1: no rule makes a venture public, so the lede keeps its first sentence and the next card names only what can be edited; cards 02 and 03 (problems, public profile) belong to L5 and are not shown',
        },
      ],
    })
  })
})
