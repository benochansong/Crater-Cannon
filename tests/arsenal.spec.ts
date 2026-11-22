import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const snap = (page: Page) =>
  page.evaluate(() => (window as any).__CRATER_QA__());
async function tickUntil(
  page: Page,
  condition: (s: any) => boolean,
  max = 300,
) {
  for (let i = 0; i < max; i++) {
    if (condition(await snap(page))) return;
    await page.clock.runFor(100);
  }
  throw Error("Expected game state was not reached");
}
async function range(page: Page, id: string, value: number) {
  await page.locator(id).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
async function start(page: Page, seed: number) {
  await page.goto("/?seed=" + seed);
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  await page.getByLabel("AI 난이도").selectOption("easy");
  await page.getByRole("button", { name: "완료" }).click();
  await page.getByRole("button", { name: "게임 시작" }).click();
  await page.clock.install();
  await page.clock.runFor(100);
}
async function launchDrone(page: Page) {
  await page.getByRole("button", { name: "공격 드론 선택" }).click();
  await expect(page.getByText(/방향키\/WASD로 드론/)).toBeVisible();
  await page.getByRole("button", { name: "건너뛰기" }).click();
  await page.getByRole("button", { name: /드론 출격/ }).click();
  await tickUntil(page, (s) => s.phase === "drone" && s.turn === "player");
}
test("modern arsenal: manual drone, missile target, manual EMP, complete match and reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page, 6);
  await launchDrone(page);
  const before = await snap(page);
  await page.keyboard.down("d");
  await page.keyboard.down("w");
  await page.clock.runFor(350);
  await page.keyboard.up("d");
  await page.keyboard.up("w");
  const moved = await snap(page);
  expect(moved.drone.x).toBeGreaterThan(before.drone.x + 30);
  expect(moved.drone.y).toBeLessThan(before.drone.y - 30);
  expect(moved.tanks[0].x).toBe(before.tanks[0].x);
  expect(moved.tanks[1].y).toBe(before.tanks[1].y);
  // Escape must pause even with a control button focused, without stale held input.
  await page.getByRole("button", { name: /드론 공격/ }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  const paused = await snap(page);
  await page.clock.runFor(2000);
  expect((await snap(page)).drone).toEqual(paused.drone);
  await page.getByRole("button", { name: "완료" }).click();
  await page.screenshot({ path: "test-results/phase3-drone.png" });
  await page.keyboard.press("Space");
  expect((await snap(page)).drone).toBeNull();
  await tickUntil(page, (s) => s.canEmp);
  await expect(page.getByText("전자 위협 감지! EMP 방어 가능")).toBeVisible();
  const threat = await snap(page);
  expect(threat.projectile.weapon).toBe("missile");
  expect(threat.defense.remaining).toBeGreaterThan(2);
  await page.keyboard.press("e");
  await page.clock.runFor(100);
  const defended = await snap(page);
  expect(defended.projectile.guided).toBe(false);
  expect(defended.tanks[0].emp).toBe(1);
  await page.keyboard.press("e");
  expect((await snap(page)).tanks[0].emp).toBe(1);
  await page.screenshot({ path: "test-results/phase3-emp.png" });
  await tickUntil(page, (s) => s.phase === "aim");
  await page.getByRole("button", { name: "유도탄 선택" }).click();
  await expect(page.getByRole("button", { name: /발사!/ })).toBeDisabled();
  await page.getByRole("button", { name: "건너뛰기" }).click();
  const target = await snap(page),
    box = await page.locator("canvas").boundingBox(),
    camera = target.visuals.camera;
  await page.mouse.click(
    box!.x +
      ((target.tanks[1].x * camera.scale + camera.x) / 1280) * box!.width,
    box!.y +
      (((target.tanks[1].y - 8) * camera.scale + camera.y) / 640) * box!.height,
  );
  expect((await snap(page)).target).toBe("ai");
  await range(page, "#angle", 35);
  await range(page, "#power", 55);
  await page.getByRole("button", { name: /발사!/ }).click();
  expect((await snap(page)).tanks[0].ammo.missile).toBe(1);
  await tickUntil(page, (s) => s.phase === "flight");
  await page.clock.runFor(600);
  await page.screenshot({ path: "test-results/phase3-missile.png" });
  for (let i = 0; i < 300; i++) {
    const s = await snap(page);
    if (s.result) break;
    if (s.canEmp)
      await page.getByRole("button", { name: "EMP 방어", exact: true }).click();
    if (s.phase === "aim") {
      const aim = await page.evaluate(async () => {
        const b = (window as any).__CRATER_QA__();
        const path = "/src/game/engine.ts";
        const { solveShot } = await import(path);
        return solveShot(
          b.tanks[0],
          b.tanks[1],
          new Float64Array(b.terrain),
          b.wind,
        );
      });
      await page.getByRole("button", { name: "기본 폭발탄 선택" }).click();
      await range(page, "#angle", aim.angle);
      await range(page, "#power", aim.power);
      await page.getByRole("button", { name: /발사!/ }).click();
    }
    await page.clock.runFor(500);
  }
  const end = await snap(page);
  expect(end.result).not.toBeNull();
  expect(end.stats.shots).toBeGreaterThan(2);
  await page.getByRole("button", { name: "다시 대결" }).click();
  const reset = await snap(page);
  expect(reset.tanks[0].emp).toBe(2);
  expect(reset.tanks[0].ammo.drone).toBe(2);
  expect(reset.tanks[0].ammo.missile).toBe(2);
  expect(reset.target).toBeNull();
  expect(reset.defense).toBeNull();
  expect(reset.drone).toBeNull();
  expect(reset.visuals.pulses).toBe(0);
  expect(errors).toEqual([]);
});
test("enemy drone is disabled by EMP; automatic defense setting persists", async ({
  page,
}) => {
  await start(page, 12);
  await launchDrone(page);
  await page.keyboard.press("Space");
  await tickUntil(page, (s) => s.canEmp);
  const attack = await snap(page);
  expect(attack.drone).not.toBeNull();
  const hp = attack.tanks[0].hp;
  await page.getByRole("button", { name: "EMP 방어", exact: true }).click();
  await page.clock.runFor(100);
  expect((await snap(page)).drone).toBeNull();
  expect((await snap(page)).tanks[0].hp).toBe(hp);
  await tickUntil(page, (s) => s.phase === "aim");
  expect((await snap(page)).round).toBe(2);
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  await page.getByLabel("자동 EMP 방어").check();
  await page.getByRole("button", { name: "완료" }).click();
  await page.reload();
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  await expect(page.getByLabel("자동 EMP 방어")).toBeChecked();
  await page.getByRole("button", { name: "완료" }).click();
});
