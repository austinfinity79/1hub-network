import { expect, type APIRequestContext, type Browser } from '@playwright/test'

import { completedAccount, IDS, QA, type Account } from './onboarding'

/**
 * WF02 L2 workspace fixtures (DEC-L2R). Every state is prepared through the
 * real APIs, as the member would reach it; nothing writes the tables directly.
 * The board persona reproduces the L2 board's content where the product has
 * a field for it, so the pixel audits compare like with like.
 */

/** The frozen Alpha stages (DEC-PDF-D5): IDEA, MVP, PILOT, SELLING, GROWTH. */
export const STAGE = {
  idea: '23000000-0000-0000-0000-000000000001',
  mvp: '23000000-0000-0000-0000-000000000002',
  pilot: '23000000-0000-0000-0000-000000000003',
  selling: '23000000-0000-0000-0000-000000000004',
  growth: '23000000-0000-0000-0000-000000000005',
} as const

/** The fields POST /ventures requires (DEC-L2R-D4). */
export const CORE = {
  summary: 'Mô tả một dòng',
  domain_ids: [QA.domain.logistics],
  stage_id: STAGE.idea,
} as const

/** FP1-OWN's person, with the fields the profile holds. */
export const BOARD_PROFILE = {
  full_name: 'Đặng Kim Chi',
  display_name: 'Đặng Kim Chi',
  headline: 'Đồng sáng lập · CEO tại Tracely',
  country_id: IDS.country,
  region_id: IDS.danang,
  bio: 'Tám năm làm vận hành chuỗi cung ứng trước khi lập Tracely. Quan tâm tới bài toán hao hụt chặng giao cuối và truy xuất nguồn gốc — hai thứ mà doanh nghiệp miền Trung hỏi nhiều nhất nhưng ít ai giải tới nơi.',
  specialization_ids: [QA.specialization.operations],
  domain_ids: [QA.domain.logistics],
  skill_ids: [QA.skill.data],
  experience: [
    {
      title: 'Đồng sáng lập · CEO',
      organization_name: 'Tracely',
      started_on: '2024-02',
      ended_on: null,
      description:
        'Dẫn đội 6 người, sản phẩm truy xuất nguồn gốc cho hợp tác xã nông sản\nĐang làm bài toán 03 và 07 của challenge Nông sản ĐBSCL',
    },
    {
      title: 'Trưởng phòng vận hành',
      organization_name: 'Công ty Logistics Mekong',
      started_on: '2019-06',
      ended_on: '2024-01',
      description:
        'Phụ trách 4 kho lạnh và đội xe 38 đầu kéo\nXây lại quy trình điều xe, giảm thời gian chờ tại cảng từ 5,5 xuống 3,2 giờ',
    },
    {
      title: 'Điều phối khai thác',
      organization_name: 'Bưu điện Đà Nẵng',
      started_on: '2016-08',
      ended_on: '2019-05',
    },
  ],
  education: [
    {
      institution: 'Đại học Bách khoa Đà Nẵng',
      programme: 'Kỹ sư · Kỹ thuật hệ thống công nghiệp',
      started_on: '2012-09',
      ended_on: '2016-06',
    },
    {
      institution: 'Đại học Kinh tế TP.HCM',
      programme: 'Thạc sĩ · Quản trị chuỗi cung ứng',
      started_on: '2020-09',
      ended_on: '2022-06',
    },
  ],
}

export async function createVenture(
  request: APIRequestContext,
  body: Record<string, unknown>,
): Promise<{ id: string; name: string }> {
  const response = await request.post('/api/v1/ventures', { data: { ...CORE, ...body } })
  expect(response.status(), await response.text()).toBe(201)
  return response.json()
}

export async function invite(
  request: APIRequestContext,
  ventureId: string,
  body: { email: string; role_label?: string | null; permission?: 'EDIT' | 'VIEW' },
): Promise<{ membership_id: string }> {
  const response = await request.post(`/api/v1/ventures/${ventureId}/team/invitations`, {
    data: body,
  })
  expect(response.status(), await response.text()).toBe(201)
  return response.json()
}

/** A unique address that has no account. */
export const freshAddress = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`

/** The two ventures of the L2 board, owned by the signed-in member. */
export async function boardVentures(request: APIRequestContext) {
  const tracely = await createVenture(request, {
    type: 'STARTUP',
    name: 'Tracely',
    summary:
      'Truy vết chuỗi giao vận bằng dữ liệu sẵn có — sản phẩm truy xuất nguồn gốc cho hợp tác xã nông sản.',
    stage_id: STAGE.pilot,
    owner_role_label: 'Founder',
  })
  const kho = await createVenture(request, {
    type: 'PROJECT',
    name: 'Kho lạnh chia sẻ',
    summary: 'Mô hình chia sẻ kho lạnh theo giờ cho hộ kinh doanh nông sản nhỏ.',
    domain_ids: [QA.domain.logistics, QA.domain.agritech],
    stage_id: STAGE.idea,
    owner_role_label: 'Founder',
  })
  return { tracely, kho }
}

/**
 * Another member, in a browser context of its own, invites `email` to its
 * venture "AgriLink" as ME7 draws it: "Cố vấn vận hành · quyền Xem".
 */
export async function inviteFromAgriLink(browser: Browser, email: string) {
  const context = await browser.newContext()
  try {
    const owner: Account = await completedAccount(context.request, 'agrilink', {
      display_name: 'AgriLink',
    })
    const venture = await createVenture(context.request, {
      type: 'STARTUP',
      name: 'AgriLink',
      stage_id: STAGE.mvp,
    })
    const invitation = await invite(context.request, venture.id, {
      email,
      role_label: 'Cố vấn vận hành',
      permission: 'VIEW',
    })
    return { owner, venture, invitation }
  } finally {
    await context.close()
  }
}
