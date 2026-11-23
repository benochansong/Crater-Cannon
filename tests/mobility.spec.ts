import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const snap = (page: Page) =>
  page.evaluate(() => (window as any).__CRATER_QA__());
async function start(page: Page) {
  await page.clock.install();
  await page.goto("/?seed=31");
  await page.getByRole("button", { name: "게임 시작" }).click();
  await page.clock.runFor(100);
  await page.locator("canvas").focus();
}
test("short keyboard movement, round-trip budget, fire from the new muzzle and reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  const before = await snap(page);
  await page.keyboard.down("d");
  await page.clock.runFor(500);
  let s = await snap(page);
  expect(s.tanks[0].x).toBeGreaterThan(before.tanks[0].x);
  expect(s.tanks[0].mobility.remaining).toBeLessThan(60);
  await page.keyboard.press(" ");
  expect((await snap(page)).phase).toBe("aim");
  await page.keyboard.up("d");
  s = await snap(page);
  const stopped = s.tanks[0].x,
    spent = 60 - s.tanks[0].mobility.remaining;
  await page.clock.runFor(200);
  expect((await snap(page)).tanks[0].x).toBe(stopped);
  await page.screenshot({ path: "test-results/phase6-short-stop.png" });
  await page.keyboard.down("a");
  await page.clock.runFor(1800);
  await page.keyboard.up("a");
  s = await snap(page);
  expect(s.tanks[0].mobility.remaining).toBe(0);
  expect(spent + stopped - s.tanks[0].x).toBeCloseTo(60, 5);
  expect(s.visuals.camera.scale).toBe(1);
  await page.getByRole("button", { name: "방어 · 이동", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /왼쪽 이동 · 장거리/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "공격 무기", exact: true }).click();
  await page.locator("canvas").focus();
  await page.keyboard.press(" ");
  s = await snap(page);
  const angle = (s.tanks[0].angle * Math.PI) / 180;
  expect(s.projectile.x).toBeCloseTo(s.tanks[0].x + 43 * Math.cos(angle), 4);
  expect(s.projectile.y).toBeCloseTo(
    s.tanks[0].y - 15 - 43 * Math.sin(angle),
    4,
  );
  await page.keyboard.down("d");
  await page.clock.runFor(300);
  await page.keyboard.up("d");
  expect((await snap(page)).tanks[0].x).toBe(s.tanks[0].x);
  await page.screenshot({ path: "test-results/phase6-fire.png" });
  for (let i = 0; i < 200; i++) {
    if ((await snap(page)).phase === "aim") break;
    await page.clock.runFor(100);
  }
  expect((await snap(page)).tanks[0].mobility.remaining).toBe(60);
  expect(errors).toEqual([]);
});
test("focus, pause, blur, touch release and long movement inputs", async ({
  page,
}) => {
  await start(page);
  const x = (await snap(page)).tanks[0].x;
  await page.locator("#angle").focus();
  await page.keyboard.down("d");
  await page.clock.runFor(300);
  await page.keyboard.up("d");
  expect((await snap(page)).tanks[0].x).toBe(x);
  await page.locator("canvas").focus();
  await page.keyboard.down("d");
  await page.clock.runFor(150);
  await page.keyboard.press("Escape");
  await page.clock.runFor(300);
  const paused = (await snap(page)).tanks[0].x;
  await page.keyboard.up("d");
  await page.clock.runFor(300);
  expect((await snap(page)).tanks[0].x).toBe(paused);
  await page.getByRole("button", { name: "완료" }).click();
  await page.locator("canvas").focus();
  await page.keyboard.down("a");
  await page.clock.runFor(150);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const blurred = (await snap(page)).tanks[0].x;
  await page.clock.runFor(200);
  await page.keyboard.up("a");
  expect((await snap(page)).tanks[0].x).toBe(blurred);
  await page.setViewportSize({ width: 390, height: 844 });
  const button = page.getByRole("button", {
    name: "단거리 오른쪽 이동",
    exact: true,
  });
  const box = await button.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.clock.runFor(200);
  await page.mouse.move(5, 5);
  await page.mouse.up();
  const touch = (await snap(page)).tanks[0].x;
  expect(touch).toBeGreaterThan(blurred);
  await page.clock.runFor(200);
  expect((await snap(page)).tanks[0].x).toBe(touch);
  await page.screenshot({
    path: "test-results/phase6-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.reload();
  await page.getByRole("button", { name: "게임 시작" }).click();
  await page.clock.runFor(100);
  await expect(
    page.getByRole("button", { name: "이동 안내 닫기" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "방어 · 이동", exact: true }).click();
  await page.getByRole("button", { name: /왼쪽 이동 · 장거리/ }).click();
  await page.clock.runFor(100);
  const long = await snap(page);
  expect(long.action.kind).toBe("move");
  await page.locator("canvas").focus();
  await page.keyboard.press("d");
  await page.keyboard.press(" ");
  expect((await snap(page)).projectile).toBeNull();
});

test("drone WASD has priority and never spends tank movement", async ({
  page,
}) => {
  await start(page);
  const initial = await snap(page);
  await page
    .getByRole("button", { name: "공격 드론 선택", exact: true })
    .click();
  await page.getByRole("button", { name: /드론 출격/ }).click();
  for (let i = 0; i < 60; i++) {
    if ((await snap(page)).phase === "drone") break;
    await page.clock.runFor(100);
  }
  expect((await snap(page)).phase).toBe("drone");
  const droneX = (await snap(page)).drone.x;
  await page.locator("canvas").focus();
  await page.keyboard.down("a");
  await page.clock.runFor(350);
  await page.keyboard.up("a");
  const moved = await snap(page);
  expect(moved.drone.x).toBeLessThan(droneX);
  expect(moved.tanks[0].x).toBe(initial.tanks[0].x);
  expect(moved.tanks[0].mobility.remaining).toBe(60);
  await page.keyboard.press(" ");
  expect((await snap(page)).phase).not.toBe("aim");
});
