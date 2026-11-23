import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const snap = (page: Page) =>
  page.evaluate(() => (window as any).__CRATER_QA__());
async function waitForState(
  page: Page,
  condition: (s: any) => boolean,
  max = 500,
) {
  for (let i = 0; i < max; i++) {
    if (condition(await snap(page))) return;
    await page.clock.runFor(100);
  }
  throw Error("State not reached");
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
  await page.getByRole("button", { name: "게임 시작" }).click();
  await page.clock.install();
  await page.clock.runFor(100);
}
async function miss(page: Page) {
  await page.getByRole("button", { name: "공격 무기", exact: true }).click();
  await page.getByRole("button", { name: "기본 폭발탄 선택" }).click();
  await range(page, "#angle", 10);
  await range(page, "#power", 20);
  await page.getByRole("button", { name: /발사!/ }).click();
  await waitForState(page, (s) => s.phase === "aim" || !!s.result);
}
async function call(page: Page, kind: "공격 헬기" | "폭격기") {
  await page.getByRole("button", { name: "항공 지원", exact: true }).click();
  await page.getByRole("button", { name: kind + " 선택" }).click();
  await expect(page.getByRole("button", { name: /지원 요청/ })).toBeDisabled();
  await page.getByRole("button", { name: "적 위치에 구역 지정" }).click();
  await expect(page.getByRole("button", { name: /지원 요청/ })).toBeEnabled();
  await page.screenshot({ path: "test-results/phase4-target.png" });
  await page.getByRole("button", { name: /지원 요청/ }).click();
  await expect(page.locator(".air-warning")).toBeVisible();
  await waitForState(
    page,
    (s) => s.phase === "air" && s.air.owner === "player",
  );
  await page.clock.runFor(kind === "공격 헬기" ? 1800 : 3000);
  await page.screenshot({
    path:
      kind === "공격 헬기"
        ? "test-results/phase4-helicopter.png"
        : "test-results/phase4-bomber.png",
  });
  await waitForState(page, (s) => s.phase === "aim" || !!s.result);
}
test("repair then helicopter, enforce shared support budget, complete victory and reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page, 1);
  await miss(page);
  await miss(page);
  let s = await snap(page);
  expect(s.tanks[0].hp).toBeLessThan(100);
  const hp = s.tanks[0].hp;
  await page.getByRole("button", { name: "방어 · 이동", exact: true }).click();
  await page.getByRole("button", { name: /긴급 정비/ }).click();
  await page.clock.runFor(800);
  s = await snap(page);
  expect(s.action.kind).toBe("repair");
  expect(s.tanks[0].hp).toBeGreaterThan(hp);
  await page.screenshot({ path: "test-results/phase4-repair.png" });
  await waitForState(page, (s) => s.phase === "aim" || !!s.result);
  expect((await snap(page)).tanks[0].repairs).toBe(1);
  await call(page, "공격 헬기");
  await page.getByRole("button", { name: "항공 지원", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "폭격기 선택" }),
  ).toBeDisabled();
  s = await snap(page);
  expect(s.supportStats.player.helicopter.shots).toBe(1);
  expect(s.supportStats.player.helicopter.damage).toBeLessThanOrEqual(27);
  expect(s.supportStats.player.bomber.shots).toBe(0);
  expect(s.supportStats.player.bomber.damage).toBeLessThanOrEqual(30);
  expect(s.revision).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < 500; i++) {
    s = await snap(page);
    if (s.result) break;
    if (s.canEmp)
      await page.getByRole("button", { name: "EMP 방어", exact: true }).click();
    if (s.phase === "aim") {
      if (
        s.pendingAir?.owner === "ai" &&
        !s.tanks[0].shield &&
        s.tanks[0].shields > 0
      ) {
        await page
          .getByRole("button", { name: "방어 · 이동", exact: true })
          .click();
        await page.getByRole("button", { name: /에너지 방어막/ }).click();
      } else if (s.tanks[0].hp < 40 && s.canRepair) {
        await page
          .getByRole("button", { name: "방어 · 이동", exact: true })
          .click();
        await page.getByRole("button", { name: /긴급 정비/ }).click();
      } else {
        const aim = await page.evaluate(async () => {
          const s = (window as any).__CRATER_QA__();
          const path = "/src/game/engine.ts";
          const { solveShot } = await import(path);
          return solveShot(
            s.tanks[0],
            s.tanks[1],
            new Float64Array(s.terrain),
            s.wind,
          );
        });
        await page
          .getByRole("button", { name: "공격 무기", exact: true })
          .click();
        await page.getByRole("button", { name: "기본 폭발탄 선택" }).click();
        await range(page, "#angle", aim.angle);
        await range(page, "#power", aim.power);
        await page.getByRole("button", { name: /발사!/ }).click();
      }
    }
    await page.clock.runFor(500);
  }
  s = await snap(page);
  expect(s.result?.outcome).toBe("victory");
  expect(s.actions.player.repair).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/phase4-victory.png" });
  await page.getByRole("button", { name: "다시 대결" }).click();
  s = await snap(page);
  expect(s.tanks[0].repairs).toBe(2);
  expect(s.tanks[0].shields).toBe(2);
  expect(s.tanks[0].shield).toBe(false);
  expect(s.tanks[0].support).toEqual({
    helicopter: 1,
    bomber: 1,
    artillery: 0,
    propeller: 0,
  });
  expect(s.pendingAir).toBeNull();
  expect(s.air).toBeNull();
  expect(s.action).toBeNull();
  expect(errors).toEqual([]);
});
test("announced enemy helicopter is reduced by one shield across all three impacts", async ({
  page,
}) => {
  await start(page, 2);
  for (let i = 0; i < 3; i++) await miss(page);
  let s = await snap(page);
  expect(s.pendingAir.kind).toBe("helicopter");
  const hp = s.tanks[0].hp;
  await expect(page.locator(".air-warning")).toContainText("적 항공 지원 예고");
  await page.getByRole("button", { name: "항공 지원", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "폭격기 선택" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "방어 · 이동", exact: true }).click();
  await page.getByRole("button", { name: /에너지 방어막/ }).click();
  await waitForState(page, (s) => s.phase === "air");
  await page.clock.runFor(2450);
  s = await snap(page);
  expect(s.tanks[0].shield).toBe(true);
  await page.screenshot({ path: "test-results/phase4-shield.png" });
  await waitForState(page, (s) => s.air === null);
  s = await snap(page);
  expect(s.tanks[0].shield).toBe(false);
  expect(hp - s.tanks[0].hp).toBeLessThanOrEqual(14);
  expect(hp - s.tanks[0].hp).toBeGreaterThan(0);
  expect(s.supportStats.ai.helicopter.shots).toBe(1);
});
test("terrain-limited bomber evasion reduces damage, preserves turn order and deforms three ground sites", async ({
  page,
}) => {
  await start(page, 1);
  for (let i = 0; i < 4; i++) await miss(page);
  let s = await snap(page);
  expect(s.pendingAir.kind).toBe("bomber");
  await expect(
    page.getByRole("button", { name: "단거리 왼쪽 이동", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "단거리 오른쪽 이동", exact: true }),
  ).toBeDisabled();
  const hp = s.tanks[0].hp,
    x = s.tanks[0].x,
    revision = s.revision,
    stationaryDamage = Math.round(
      30 * (1 - Math.abs(x - s.pendingAir.targetX) / 170),
    );
  await page.screenshot({ path: "test-results/phase4-warning.png" });
  await page.getByRole("button", { name: "방어 · 이동", exact: true }).click();
  await page.getByRole("button", { name: /왼쪽 이동 · 장거리/ }).click();
  await page.clock.runFor(100);
  s = await snap(page);
  expect(s.tanks[0].x).toBeLessThan(x);
  expect(s.action.kind).toBe("move");
  await waitForState(page, (s) => s.phase === "air");
  await page.clock.runFor(1600);
  await page.screenshot({ path: "test-results/phase4-evade.png" });
  await waitForState(page, (s) => s.air === null);
  s = await snap(page);
  expect(x - s.tanks[0].x).toBeLessThanOrEqual(145.001);
  // The new shared slope limit stops this crater escape early; a flat 145-unit escape is covered in phase4.test.ts.
  expect(x - s.tanks[0].x).toBeGreaterThan(40);
  expect(x - s.tanks[0].x).toBeLessThan(60);
  expect(hp - s.tanks[0].hp).toBeLessThan(stationaryDamage);
  expect(s.revision - revision).toBe(3);
  expect(s.pendingAir).toBeNull();
});

test("player bomber works as the single chosen air operation", async ({
  page,
}) => {
  await start(page, 8);
  await call(page, "폭격기");
  const s = await snap(page);
  expect(s.supportStats.player.bomber.shots).toBe(1);
  expect(s.tanks[0].airRemaining).toBe(0);
  await page.getByRole("button", { name: "항공 지원", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "공격 헬기 선택" }),
  ).toBeDisabled();
});
