import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

/**
 * M0-T04 — primitive behaviour, accessibility and deterministic rendering.
 *
 * Runs against the dev-gated primitives harness. That harness is not a product
 * screen and has no baseline in design-reference/final, so nothing here compares
 * against an approved design.
 *
 * Behaviour is asserted in a real browser rather than jsdom: focus-visible,
 * native disabled semantics and aria wiring all depend on real rendering, and a
 * simulated DOM would weaken exactly the evidence this task needs.
 */

const ACTUAL_DIR = path.join(__dirname, '..', 'actual')
const HARNESS = '/dev/primitives'

async function openHarness(page: Page) {
  await page.goto(HARNESS)
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15_000 })
}

test.beforeEach(async ({ page }) => {
  await openHarness(page)
})

test.describe('M0-T04 button', () => {
  test('is a native button and responds to click', async ({ page }) => {
    const button = page.getByTestId('btn-primary')

    await expect(button).toHaveJSProperty('tagName', 'BUTTON')
    await expect(page.getByTestId('click-count')).toHaveText('0')
    await button.click()
    await expect(page.getByTestId('click-count')).toHaveText('1')
  })

  test('activates from the keyboard with Enter and Space', async ({ page }) => {
    const button = page.getByTestId('btn-primary')

    await button.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('click-count')).toHaveText('1')

    await page.keyboard.press(' ')
    await expect(page.getByTestId('click-count')).toHaveText('2')
  })

  test('shows a visible focus ring for keyboard focus but not pointer click', async ({ page }) => {
    const button = page.getByTestId('btn-primary')

    // Pointer interaction focuses the control but must not draw the ring,
    // otherwise every mouse user sees a keyboard affordance.
    await button.click()
    const afterPointer = await button.evaluate((el) => ({
      focused: document.activeElement === el,
      focusVisible: el.matches(':focus-visible'),
      outline: getComputedStyle(el).outlineStyle,
    }))

    expect(afterPointer.focused).toBe(true)
    expect(afterPointer.focusVisible).toBe(false)
    expect(afterPointer.outline).toBe('none')

    // Keyboard interaction must draw it.
    await page.keyboard.press('Tab')
    const afterKeyboard = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return null
      return {
        focusVisible: el.matches(':focus-visible'),
        outline: getComputedStyle(el).outlineStyle,
      }
    })

    expect(afterKeyboard?.focusVisible).toBe(true)
    expect(afterKeyboard?.outline).toBe('solid')
  })

  test('disabled blocks activation by pointer and keyboard', async ({ page }) => {
    const button = page.getByTestId('btn-disabled')

    await expect(button).toBeDisabled()
    await button.click({ force: true })
    await expect(page.getByTestId('disabled-click-count')).toHaveText('0')

    // A disabled control must also be skipped by sequential focus.
    const focusable = await button.evaluate((el) => (el as HTMLButtonElement).disabled)
    expect(focusable).toBe(true)
  })

  test('loading disables the control and announces busy', async ({ page }) => {
    const button = page.getByTestId('btn-loading')

    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('aria-busy', 'true')
    await expect(button).toHaveAttribute('data-loading', 'true')
    // The spinner is decorative; the label carries the meaning.
    await expect(page.getByTestId('button-spinner')).toHaveAttribute('aria-hidden', 'true')
    await expect(button).toContainText('Đang gửi')
  })

  test('submits its form when type is submit', async ({ page }) => {
    const before = await page.getByTestId('click-count').textContent()
    await page.getByTestId('btn-submit').click()
    await expect(page.getByTestId('click-count')).not.toHaveText(before ?? '')
  })

  test('defaults to type=button so it cannot submit by accident', async ({ page }) => {
    await expect(page.getByTestId('btn-primary')).toHaveAttribute('type', 'button')
  })
})

test.describe('M0-T04 field and input accessibility', () => {
  test('associates the label with its control', async ({ page }) => {
    const input = page.getByTestId('input-default')
    const id = await input.getAttribute('id')

    expect(id).toBeTruthy()

    const labelFor = await page.evaluate(
      (controlId) => document.querySelector(`label[for="${controlId}"]`)?.textContent,
      id,
    )
    expect(labelFor).toBe('Email')

    // Clicking the label must move focus into the control.
    await page.locator(`label[for="${id}"]`).click()
    await expect(input).toBeFocused()
  })

  test('describes the control with its helper text', async ({ page }) => {
    const input = page.getByTestId('input-default')
    const describedBy = await input.getAttribute('aria-describedby')

    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy}`)).toHaveText('Chúng tôi gửi một link dùng một lần.')
    await expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('marks an invalid control and points it at the error, not the helper', async ({ page }) => {
    const input = page.getByTestId('input-invalid')

    await expect(input).toHaveAttribute('aria-invalid', 'true')

    const describedBy = await input.getAttribute('aria-describedby')
    const message = page.locator(`#${describedBy}`)

    await expect(message).toHaveText('Email không hợp lệ.')
    await expect(message).toHaveAttribute('role', 'alert')
    await expect(message).toHaveAttribute('data-tone', 'error')
  })

  test('supports disabled and readonly as distinct states', async ({ page }) => {
    await expect(page.getByTestId('input-disabled')).toBeDisabled()

    const readonly = page.getByTestId('input-readonly')
    await expect(readonly).not.toBeDisabled()
    await expect(readonly).toHaveAttribute('readonly', '')
    // Readonly stays focusable and copyable, which is the point of it.
    await readonly.focus()
    await expect(readonly).toBeFocused()
  })

  test('gives each field instance unique ids', async ({ page }) => {
    const ids = await page
      .locator('.ui-input')
      .evaluateAll((els) => els.map((el) => el.getAttribute('id')))

    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

test.describe('M0-T04 notice', () => {
  test('uses polite status for info and assertive alert for error', async ({ page }) => {
    const info = page.locator('.ui-notice[data-tone="info"]')
    const error = page.locator('.ui-notice[data-tone="error"]')

    await expect(info).toHaveAttribute('role', 'status')
    await expect(error).toHaveAttribute('role', 'alert')
  })
})

test.describe('M0-T04 deterministic rendering', () => {
  test('renders at 1440x900 with DPR 1 and Be Vietnam Pro', async ({ page }) => {
    const state = await page.evaluate(() => {
      const first = (stack: string) =>
        stack
          .split(',')[0]!
          .trim()
          .replace(/^["']|["']$/g, '')
      const button = document.querySelector('.ui-button')

      return {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
        bodyFamily: first(getComputedStyle(document.body).fontFamily),
        buttonFamily: button ? first(getComputedStyle(button).fontFamily) : null,
        buttonWeight: button ? Number(getComputedStyle(button).fontWeight) : null,
        buttonSize: button ? getComputedStyle(button).fontSize : null,
      }
    })

    expect(state.width).toBe(1440)
    expect(state.height).toBe(900)
    expect(state.dpr).toBe(1)
    expect(state.bodyFamily).toBe('Be Vietnam Pro')
    expect(state.buttonFamily).toBe('Be Vietnam Pro')
    // Design SOT 2.4 button step is 16/20 SemiBold.
    expect(state.buttonWeight).toBe(600)
    expect(state.buttonSize).toBe('16px')
  })

  test('leaves unresolved cosmetic values visibly unset', async ({ page }) => {
    const computed = await page.evaluate(() => {
      const button = document.querySelector('.ui-button')!
      const surface = document.querySelector('.ui-surface')!
      return {
        buttonRadius: getComputedStyle(button).borderRadius,
        surfaceRadius: getComputedStyle(surface).borderRadius,
        surfaceShadow: getComputedStyle(surface).boxShadow,
      }
    })

    // Provisional, not approved: radius and shadow stay neutral globally. WF01-S01
    // measured values for its own card and applies them locally only (final
    // audit), because other approved references use different geometry.
    expect(computed.buttonRadius).toBe('0px')
    expect(computed.surfaceRadius).toBe('0px')
    expect(computed.surfaceShadow).toBe('none')
  })

  test('freezes the loading spinner under reduced motion', async ({ page }) => {
    // The visual config sets reducedMotion: 'reduce', so capture is stable.
    const animation = await page.evaluate(
      () => getComputedStyle(document.querySelector('.ui-button__spinner')!).animationName,
    )
    expect(animation).toBe('none')
  })
})

test.describe('M0-T04 primitives evidence', () => {
  test('renders identically to the primitives baseline', async ({ page }) => {
    await page.screenshot({
      path: path.join(ACTUAL_DIR, 'primitives-1440x900.png'),
      fullPage: true,
      animations: 'disabled',
    })

    await expect(page).toHaveScreenshot('primitives.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    })
  })
})
