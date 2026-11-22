import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function setRange(page: Page, selector: string, value: number) {
  await page.locator(selector).evaluate((el, v) => { const input = el as HTMLInputElement; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v)); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, value);
}
async function snapshot(page: Page) { return page.evaluate(() => (window as any).__CRATER_QA__()); }
async function plan(page: Page) { return page.evaluate(async () => { const state = (window as any).__CRATER_QA__(); const path = '/src/game/engine.ts'; const { solveShot } = await import(path); return solveShot(state.tanks[0], state.tanks[1], new Float64Array(state.terrain), state.wind); }); }
test('Phase 1: menu, aiming, weapons, real AI battle, result and restart', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: '게임 시작' })).toBeVisible();
  await page.screenshot({ path: 'test-results/phase1-menu.png' });
  await page.getByRole('button', { name: '게임 방법', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button', { name: '알겠어요' }).click();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.clock.install();
  await expect(page.getByText('첫 포격 가이드', { exact: true })).toBeVisible();
  await page.locator('canvas').focus(); await page.keyboard.press('ArrowUp'); await expect(page.locator('#angle')).toHaveValue('46'); await page.keyboard.press('ArrowRight'); await expect(page.locator('#power')).toHaveValue('56');
  const box = await page.locator('canvas').boundingBox(); await page.mouse.move(box!.x + box!.width * .4, box!.y + box!.height * .3); await page.mouse.down(); await page.mouse.move(box!.x + box!.width * .3, box!.y + box!.height * .15); await page.mouse.up(); expect(Number(await page.locator('#angle').inputValue())).not.toBe(46);
  await page.getByRole('button', { name: '크레이터탄 선택' }).click();
  let turns = 0;
  for (let step = 0; step < 240; step++) {
    const s = await snapshot(page); if (s.result) break;
    if (s.phase === 'aim') {
      const aim = await plan(page); await setRange(page, '#angle', aim.angle); await setRange(page, '#power', aim.power);
      if (turns > 0) await page.getByRole('button', { name: turns === 1 ? '충격파탄 선택' : '기본 폭발탄 선택' }).click();
      await page.getByRole('button', { name: /발사!/ }).click(); turns++;
      expect((await snapshot(page)).stats.shots).toBe(turns); await expect(page.getByRole('button', { name: /대기 중/ })).toBeDisabled();
      if (turns === 1) await page.screenshot({ path: 'test-results/phase1-flight.png' });
    }
    await page.clock.runFor(1000);
  }
  const s = await snapshot(page); expect(s.result).not.toBeNull(); expect(s.revision).toBeGreaterThan(2); expect(s.round).toBeGreaterThan(1); expect(s.stats.damage).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '다시 대결' })).toBeVisible(); await page.screenshot({ path: 'test-results/phase1-result.png' });
  await page.getByRole('button', { name: '다시 대결' }).click(); const fresh = await snapshot(page); expect(fresh.tanks[0].hp).toBe(100); expect(fresh.tanks[1].hp).toBe(100); expect(fresh.stats.shots).toBe(0); expect(fresh.revision).toBe(0); expect(fresh.projectile).toBeNull();
  expect(errors).toEqual([]);
});
test('settings persist, records are safe, mobile layout fits', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '설정', exact: true }).first().click();
  await page.getByLabel('AI 난이도').selectOption('hard'); await page.getByLabel('효과음 음소거').check(); await page.getByLabel('화면 흔들림').uncheck(); await setRange(page, 'input[aria-label="볼륨"]', .3); await page.getByRole('button', { name: '완료' }).click();
  await page.reload(); await page.getByRole('button', { name: '설정', exact: true }).first().click(); await expect(page.getByLabel('AI 난이도')).toHaveValue('hard'); await expect(page.getByLabel('효과음 음소거')).toBeChecked(); await expect(page.getByLabel('화면 흔들림')).not.toBeChecked(); await expect(page.getByLabel('볼륨')).toHaveValue('0.3'); await page.getByRole('button', { name: '완료' }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole('button', { name: '게임 시작' })).toBeVisible(); await page.getByRole('button', { name: '게임 시작' }).click(); await expect(page.getByRole('button', { name: /발사!/ })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: 'test-results/phase1-mobile.png' });
});
