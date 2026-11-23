import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const snap = (p: Page) => p.evaluate(() => (window as any).__CRATER_QA__());
async function range(p: Page, id: string, v: number) {
  await p.locator(id).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);
}
async function until(p: Page, check: (s: any) => boolean) {
  for (let i = 0; i < 100; i++) {
    const s = await snap(p);
    if (check(s)) return s;
    await p.clock.runFor(500);
  }
  throw Error("State not reached");
}
for (const side of ["left", "right"])
  test(`Balanced ${side}: HUD, drag, movement, actual shot, drone and air approach`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.install();
    await page.goto("/?seed=31&side=" + side);
    await page.evaluate(() => {
      localStorage.setItem("crater.hint.mobility", "done");
      localStorage.setItem("crater.hint.drone", "done");
    });
    await page.getByRole("button", { name: "게임 시작" }).click();
    await page.clock.runFor(300);
    let s = await snap(page);
    expect(s.placement).toBe(side);
    expect(s.tanks[0].facing).toBe(side === "left" ? 1 : -1);
    const player = await page
        .locator(".hud .pilot-card:not(.enemy)")
        .boundingBox(),
      enemy = await page.locator(".hud .enemy").boundingBox(),
      wind = await page.locator(".hud .wind-card").boundingBox();
    expect(player && enemy && wind).toBeTruthy();
    expect(player!.x < enemy!.x).toBe(side === "left");
    expect(wind!.x).toBeGreaterThan(Math.min(player!.x, enemy!.x));
    expect(wind!.x).toBeLessThan(Math.max(player!.x, enemy!.x));
    await expect(page.getByLabel("조준 분석")).toContainText("BALANCED AIM");
    await expect(page.locator(".aim-forecast")).not.toContainText(
      "예상 직접 명중",
    );
    expect(s.aiming.endpointVisible).toBe(false);
    await page.setViewportSize({ width: 390, height: 844 });
    const mp = await page.locator(".hud .pilot-card:not(.enemy)").boundingBox(),
      me = await page.locator(".hud .enemy").boundingBox();
    expect(mp!.x < me!.x).toBe(side === "left");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(391);
    await page.screenshot({
      path: `test-results/phase91-mobile-${side}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const x = s.tanks[0].x;
    await page.locator("canvas").focus();
    await page.keyboard.down("a");
    await page.clock.runFor(400);
    await page.keyboard.up("a");
    await page.clock.runFor(300);
    expect((await snap(page)).tanks[0].x).toBeLessThan(x);
    await page.keyboard.down("d");
    await page.clock.runFor(700);
    await page.keyboard.up("d");
    await page.clock.runFor(400);
    s = await snap(page);
    expect(s.tanks[0].x).toBeGreaterThan(x);
    const box = await page.locator("canvas").boundingBox();
    await page.mouse.move(
      box!.x + box!.width * 0.5,
      box!.y + box!.height * 0.3,
    );
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width * (side === "left" ? 0.6 : 0.4),
      box!.y + box!.height * 0.2,
    );
    await page.mouse.up();
    expect(
      Number(await page.locator("#angle").inputValue()),
    ).toBeGreaterThanOrEqual(10);
    expect(
      Number(await page.locator("#angle").inputValue()),
    ).toBeLessThanOrEqual(80);
    const q = await page.evaluate(async () => {
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
    await range(page, "#angle", q.angle);
    await range(page, "#power", q.power);
    await page.clock.runFor(200);
    s = await snap(page);
    const prediction = s.aiming.prediction;
    expect(s.aiming.endpointVisible).toBe(false);
    expect(s.aiming.visible.at(-1).alpha).toBeLessThan(0.1);
    await page.screenshot({
      path: `test-results/phase91-balanced-${side}.png`,
      fullPage: true,
    });
    await page.locator("button.fire").click();
    const fired = await until(page, (s) => s.history.length > 0);
    expect(fired.history[0].impact.x).toBeCloseTo(prediction.impact.x, 6);
    expect(fired.aiming.historyMarkers).toBe(1);
    await until(page, (s) => s.phase === "aim");
    await expect(page.getByLabel("조준 분석")).toContainText("착탄 오차");
    await page.getByRole("button", { name: "공격 드론 선택" }).click();
    const hint = page.getByRole("button", { name: "건너뛰기" });
    if (await hint.isVisible()) await hint.click();
    await page.locator("button.fire").click();
    await until(page, (s) => s.phase === "drone");
    s = await snap(page);
    const dx = s.drone.x;
    await page.keyboard.down(side === "left" ? "d" : "a");
    await page.clock.runFor(350);
    await page.keyboard.up(side === "left" ? "d" : "a");
    expect(
      ((await snap(page)).drone.x - dx) * (side === "left" ? 1 : -1),
    ).toBeGreaterThan(30);
    await page.keyboard.press("Space");
    await until(page, (s) => s.phase === "aim");
    await page.getByRole("button", { name: "항공 지원", exact: true }).click();
    await page.getByRole("button", { name: "공격 헬기 선택" }).click();
    await page.getByRole("button", { name: "적 위치에 구역 지정" }).click();
    await page.getByRole("button", { name: /지원 요청/ }).click();
    s = await snap(page);
    expect(s.pendingAir.facing).toBe(side === "left" ? 1 : -1);
    await until(page, (s) => s.phase === "air" && s.air.owner === "player");
    await until(page, (s) => s.air?.owner === "player" && s.air.age >= 1.8);
    await page.screenshot({
      path: `test-results/phase91-air-${side}.png`,
      fullPage: true,
    });
    await until(page, (s) => s.phase === "aim" || !!s.result);
    expect(errors).toEqual([]);
    console.log(
      "SIDE_PROOF",
      JSON.stringify({
        side,
        predicted: prediction.impact,
        actual: fired.history[0].impact,
        errors,
      }),
    );
  });
test("Legacy choices migrate, all new choices persist, training stays full with off", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/?seed=31&side=right");
  for (const [old, next] of [
    ["default", "balanced"],
    ["extended", "beginner"],
    ["off", "off"],
    ["expert", "expert"],
    ["invalid", "balanced"],
  ]) {
    await page.evaluate(
      (old) =>
        localStorage.setItem(
          "crater.settings",
          JSON.stringify({ aimGuide: old, difficulty: "hard" }),
        ),
      old,
    );
    await page.reload();
    await page
      .getByRole("button", { name: "설정", exact: true })
      .first()
      .click();
    await expect(page.getByLabel("조준 보조")).toHaveValue(next);
    await expect(page.getByLabel("AI 난이도")).toHaveValue("hard");
    await page.getByRole("button", { name: "완료" }).click();
  }
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  await page.getByLabel("조준 보조").selectOption("off");
  await page.getByRole("button", { name: "완료" }).click();
  await page.getByRole("button", { name: /사격 훈련 FIRING RANGE/ }).click();
  await page.getByRole("button", { name: /TARGET A/ }).click();
  await page.clock.runFor(300);
  const s = await snap(page);
  expect(s.placement).toBe("left");
  expect(s.aiming.guideLevel).toBe("full");
  expect(s.tanks[0].x).toBe(180);
  await expect(page.getByLabel("조준 분석")).toContainText("훈련 · 전체 예측");
  await page.screenshot({
    path: "test-results/phase91-training.png",
    fullPage: true,
  });
});
