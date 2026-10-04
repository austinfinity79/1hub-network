/**
 * ADMIN-PROD-02 — category foundation (ADMIN-PROD-01 categories contract).
 *
 * Categories are the existing `vocabulary_items` of the existing
 * `vocabulary_types`; nothing else. An admin (`vocabulary:manage`,
 * PLATFORM_ADMIN only) may edit an item's label and order and move it between
 * ACTIVE and ARCHIVED, and create items of the open types (slug fixed at
 * creation). VENTURE_STAGE codes are product logic: label and order only. No
 * category type is ever created, and no item is ever deleted (it is archived).
 * No generic configuration or CMS engine.
 */

export type CategoryChange = 'create' | 'label' | 'order' | 'archive'

export const CATEGORY_POLICY: Readonly<Record<string, Readonly<Record<CategoryChange, boolean>>>> =
  {
    COUNTRY: { create: true, label: true, order: true, archive: true },
    REGION: { create: true, label: true, order: true, archive: true },
    DOMAIN: { create: true, label: true, order: true, archive: true },
    SKILL: { create: true, label: true, order: true, archive: true },
    SPECIALIZATION: { create: true, label: true, order: true, archive: true },
    VENTURE_STAGE: { create: false, label: true, order: true, archive: false },
  }

export const CATEGORY_TYPE_CREATION_ALLOWED = false
export const CATEGORY_ITEM_DELETION_ALLOWED = false

export const CATEGORY_STATUSES = ['ACTIVE', 'ARCHIVED'] as const

/** False for an unknown type and for every change the policy does not list. */
export function categoryChangeAllowed(typeCode: string, change: CategoryChange): boolean {
  return Object.hasOwn(CATEGORY_POLICY, typeCode) && CATEGORY_POLICY[typeCode]![change] === true
}
