import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
async function setRange(page: Page, selector: string, value: number) {
  await page.locator(selector).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
async function snapshot(page: Page) {
  return page.evaluate(() => (window as any).__CRATER_QA__());
}
async function plan(page: Page) {
  return page.evaluate(async () => {
    const state = (window as any).__CRATER_QA__();
    const path = "/src/game/engine.ts";
    const { solveShot } = await import(path);
    return solveShot(
      state.tanks[0],
      state.tanks[1],
      new Float64Array(state.terrain),
      state.wind,
    );
  });
}
for (const difficulty of ["easy", "normal", "hard"])
  test(
    "Full battle: " + difficulty + " aiming, weapons, result and restart",
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const side = difficulty === "easy" ? "left" : "right";
      await page.clock.install();
      await page.goto("/?seed=31&side=" + side);
      await expect(
        page.getByRole("button", { name: "게임 시작" }),
      ).toBeVisible();
      await page.screenshot({
        path: "test-results/menu-" + difficulty + ".png",
      });
      await page
        .getByRole("button", { name: "게임 방법", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "알겠어요" }).click();
      await page
        .getByRole("button", { name: "설정", exact: true })
        .first()
        .click();
      await page.getByLabel("AI 난이도").selectOption(difficulty);
      await page.getByRole("button", { name: "완료" }).click();
      await page.getByRole("button", { name: "게임 시작" }).click();
      await page.clock.runFor(100);
      expect((await snapshot(page)).placement).toBe(side);
      expect((await snapshot(page)).aiming.guideLevel).toBe("partial");
      expect((await snapshot(page)).aiming.endpointVisible).toBe(false);
      await expect(
        page.getByText("첫 포격 가이드", { exact: true }),
      ).toBeVisible();
      await page.locator("canvas").focus();
      await page.keyboard.press("ArrowUp");
      await expect(page.locator("#angle")).toHaveValue("46");
      await page.keyboard.press("ArrowRight");
      await expect(page.locator("#power")).toHaveValue("56");
      const box = await page.locator("canvas").boundingBox();
      await page.mouse.move(
        box!.x + box!.width * 0.4,
        box!.y + box!.height * 0.3,
      );
      await page.mouse.down();
      await page.mouse.move(
        box!.x + box!.width * 0.3,
        box!.y + box!.height * 0.15,
      );
      await page.mouse.up();
      expect(Number(await page.locator("#angle").inputValue())).not.toBe(46);
      await page.getByRole("button", { name: "크레이터탄 선택" }).click();
      let turns = 0;
      const effects = new Set<string>();
      for (let step = 0; step < 240; step++) {
        const s = await snapshot(page);
        if (s.result) break;
        expect(s.visuals.particles).toBeLessThanOrEqual(240);
        if (s.phase === "resolve" && !effects.has(String(turns))) {
          effects.add(String(turns));
          await page.screenshot({
            path: "test-results/impact-" + difficulty + "-" + turns + ".png",
          });
        }
        if (s.phase === "aim") {
          const aim = await plan(page);
          await setRange(page, "#angle", aim.angle);
          await setRange(page, "#power", aim.power);
          if (turns > 0)
            await page
              .getByRole("button", {
                name: turns === 1 ? "충격파탄 선택" : "기본 폭발탄 선택",
              })
              .click();
          await page.getByRole("button", { name: /발사!/ }).click();
          turns++;
          expect((await snapshot(page)).stats.shots).toBe(turns);
          await expect(
            page.getByRole("button", { name: /대기 중/ }),
          ).toBeDisabled();
          if (turns === 1)
            await page.screenshot({
              path: "test-results/flight-" + difficulty + ".png",
            });
        }
        await page.clock.runFor(1000);
      }
      const s = await snapshot(page);
      expect(s.result).not.toBeNull();
      expect(s.revision).toBeGreaterThan(2);
      expect(s.round).toBeGreaterThan(1);
      expect(s.stats.damage).toBeGreaterThan(0);
      await expect(
        page.getByRole("button", { name: "다시 대결" }),
      ).toBeVisible();
      await page.screenshot({
        path: "test-results/result-" + difficulty + ".png",
      });
      await page.getByRole("button", { name: "다시 대결" }).click();
      const fresh = await snapshot(page);
      expect(fresh.tanks[0].hp).toBe(100);
      expect(fresh.tanks[1].hp).toBe(100);
      expect(fresh.stats.shots).toBe(0);
      expect(fresh.revision).toBe(0);
      expect(fresh.projectile).toBeNull();
      expect(fresh.visuals.particles).toBe(0);
      expect(fresh.visuals.bursts).toBe(0);
      expect(fresh.visuals.camera.scale).toBe(1);
      console.log("BATTLE_RESULT", difficulty, JSON.stringify(s.result));
      expect(errors).toEqual([]);
    },
  );
test("settings persist, records are safe, mobile layout fits", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  await page.getByLabel("AI 난이도").selectOption("hard");
  await page.getByLabel("효과음 음소거").check();
  await page.getByLabel("화면 흔들림").uncheck();
  await setRange(page, 'input[aria-label="볼륨"]', 0.3);
  await page.getByRole("button", { name: "완료" }).click();
  await page.reload();
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  await expect(page.getByLabel("AI 난이도")).toHaveValue("hard");
  await expect(page.getByLabel("효과음 음소거")).toBeChecked();
  await expect(page.getByLabel("화면 흔들림")).not.toBeChecked();
  await expect(page.getByLabel("볼륨")).toHaveValue("0.3");
  await page.getByRole("button", { name: "완료" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "게임 시작" })).toBeVisible();
  await page.getByRole("button", { name: "게임 시작" }).click();
  await expect(page.getByRole("button", { name: /발사!/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png" });
});

test("high arcs stay visible, settings pause a flying projectile, effects expire", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "게임 시작" }).click();
  await page.clock.install();
  await page.clock.runFor(100);
  await setRange(page, "#angle", 80);
  await setRange(page, "#power", 100);
  await page.getByRole("button", { name: /발사!/ }).click();
  // Include the modern 2.5-second shield response window before observing the high arc.
  await page.clock.runFor(4800);
  const high = await snapshot(page);
  expect(high.projectile).not.toBeNull();
  expect(high.visuals.camera.scale).toBeLessThan(0.85);
  const projected =
    high.projectile.y * high.visuals.camera.scale + high.visuals.camera.y;
  expect(projected).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/high-arc.png" });
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  const before = await snapshot(page);
  await page.clock.runFor(5000);
  const after = await snapshot(page);
  expect(after.projectile.x).toBe(before.projectile.x);
  expect(after.projectile.y).toBe(before.projectile.y);
  await page.getByLabel("화면 흔들림").uncheck();
  await page.getByRole("button", { name: "완료" }).click();
  for (let i = 0; i < 60; i++) {
    if ((await snapshot(page)).phase === "aim") break;
    await page.clock.runFor(1000);
  }
  await page.clock.runFor(4000);
  const settled = await snapshot(page);
  expect(settled.phase).toBe("aim");
  expect(settled.visuals.particles).toBe(0);
  expect(settled.visuals.bursts).toBe(0);
  expect(settled.visuals.flashes).toBe(0);
  expect(settled.visuals.labels).toBe(0);
});
test("16:9 desktop keeps the fire controls in the first screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page.getByRole("button", { name: "게임 시작" }).click();
  const fire = page.getByRole("button", { name: /발사!/ });
  await expect(fire).toBeVisible();
  const box = await fire.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(768);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/desktop-1366.png" });
});
