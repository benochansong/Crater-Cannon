import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const snap = (page: Page) =>
  page.evaluate(() => (window as any).__CRATER_QA__());
const ids = ["normandy", "iron", "last-line", "shadow", "last-signal"];
async function range(page: Page, id: string, value: number) {
  await page.locator(id).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
async function fixture(page: Page, completed: number, seed = 31) {
  await page.clock.install();
  await page.goto("/?seed=" + seed);
  await page.evaluate(
    ({ ids, current }) =>
      localStorage.setItem(
        "crater.campaign.v1",
        JSON.stringify({
          version: 1,
          current,
          completed: ids,
          grades: { normandy: "S", iron: "A", "last-line": "B", shadow: "S" },
          supplies: 800,
          transitionSeen: true,
        }),
      ),
    {
      ids: ids.slice(0, completed),
      current: completed === 4 ? "last-signal" : "blind-enemy",
    },
  );
  await page.reload();
  await page.getByRole("button", { name: /스토리 캠페인/ }).click();
}
async function launch(page: Page, title: string) {
  await page
    .locator(".mission-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByRole("button", { name: "브리핑 보기" })
    .click();
  await page.getByRole("button", { name: "작전 시작" }).click();
  await page.clock.runFor(100);
}
async function plan(page: Page) {
  return page.evaluate(async () => {
    const s = (window as any).__CRATER_QA__(),
      path = "/src/game/engine.ts";
    const { solveShot } = await import(path);
    return solveShot(
      s.tanks[0],
      s.facility,
      new Float64Array(s.terrain),
      s.wind,
      [...s.tanks, s.facility],
    );
  });
}
async function play(
  page: Page,
  mode: "defend" | "radar" | "lose-defend" | "lose-radar",
) {
  const targets = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const s = await snap(page);
    if (s.result) return { s, targets };
    if (s.turn === "ai") targets.add(s.aiAttackTarget);
    if (mode !== "lose-defend") {
      if (s.canEmp)
        await page
          .getByRole("button", { name: "EMP 방어", exact: true })
          .click();
      else if (
        s.canShield &&
        s.turn === "ai" &&
        ["deploy", "flight", "air", "drone"].includes(s.phase)
      )
        await page.keyboard.press("r");
    }
    if (s.phase === "aim") {
      if (mode === "defend" && s.canReinforce && s.facility.hp <= 55) {
        await page.getByRole("button", { name: /시설 긴급 보강/ }).click();
        await page.screenshot({ path: "test-results/phase7-reinforce.png" });
      } else if (mode !== "lose-defend" && s.tanks[0].hp <= 45 && s.canRepair) {
        await page
          .getByRole("button", { name: "방어 · 이동", exact: true })
          .click();
        await page.getByRole("button", { name: /긴급 정비/ }).click();
      } else {
        await page
          .getByRole("button", { name: "공격 무기", exact: true })
          .click();
        await page
          .getByRole("button", { name: "기본 폭발탄 선택", exact: true })
          .click();
        const p =
          mode === "radar" ? await plan(page) : { angle: 10, power: 20 };
        await range(page, "#angle", p.angle);
        await range(page, "#power", p.power);
        await page.getByRole("button", { name: /발사!/ }).click();
      }
    }
    await page.clock.runFor(500);
  }
  throw Error("Objective did not finish");
}
test("legacy four-mission save unlocks defense, survive six rounds, then destroy radar and persist six records", async ({
  page,
}) => {
  test.setTimeout(360000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fixture(page, 4);
  await expect(page.getByText("보급 점수 800 · 완료 4/8")).toBeVisible();
  await page.screenshot({
    path: "test-results/phase7-campaign.png",
    fullPage: true,
  });
  await launch(page, "최후의 통신소");
  await expect(page.getByLabel("작전 목표 HUD")).toBeVisible();
  expect((await snap(page)).facility.hp).toBe(70);
  await page.screenshot({ path: "test-results/phase7-defense.png" });
  const defended = await play(page, "defend");
  expect(defended.s.result.reason).toBe("defended");
  expect(defended.s.result.enemyHp).toBeGreaterThan(0);
  expect(defended.s.completedRounds).toBe(6);
  expect(defended.s.objective.reinforcement).toBe(1);
  expect(defended.targets.has("objective")).toBe(true);
  expect(defended.targets.has("player")).toBe(true);
  await expect(page.getByRole("heading", { name: /작전 성공/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/phase7-defense-victory.png",
    fullPage: true,
  });
  let saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crater.campaign.v1")!),
  );
  expect(saved.supplies).toBe(1150);
  expect(saved.unlocked).toHaveLength(6);
  expect(saved.grades.iron).toBe("A");
  await page.getByRole("button", { name: "다음 임무", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "적의 눈을 꺼라", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "작전 시작" }).click();
  await page.clock.runFor(100);
  await page.locator("canvas").focus();
  await page.keyboard.down("d");
  await page.clock.runFor(200);
  await page.keyboard.up("d");
  expect((await snap(page)).tanks[0].mobility.remaining).toBeLessThan(60);
  await page.getByRole("button", { name: "유도탄 선택", exact: true }).click();
  await page
    .getByRole("button", { name: "레이더 시설 목표 선택", exact: true })
    .click();
  const p = await plan(page);
  await range(page, "#angle", p.angle);
  await range(page, "#power", p.power);
  expect((await snap(page)).target).toBe("objective");
  await page.screenshot({ path: "test-results/phase7-radar-target.png" });
  await page.getByRole("button", { name: /발사!/ }).click();
  expect((await snap(page)).projectile.target).toBe("objective");
  const radar = await play(page, "radar");
  expect(radar.s.result.reason).toBe("target-destroyed");
  expect(radar.s.result.enemyHp).toBeGreaterThan(0);
  await expect(page.getByRole("button", {name:"다음 임무",exact:true})).toBeVisible();
  await page.screenshot({
    path: "test-results/phase7-radar-victory.png",
    fullPage: true,
  });
  saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crater.campaign.v1")!),
  );
  expect(saved.completed).toHaveLength(6);
  expect(saved.supplies).toBe(1550);
  await page.getByRole("button", { name: "임무 재도전" }).click();
  await page.clock.runFor(100);
  expect((await snap(page)).facility.hp).toBe(65);
  expect((await snap(page)).stats.shots).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: /스토리 캠페인/ }).click();
  await expect(page.getByText("보급 점수 1550 · 완료 6/8")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("crater.records")),
  ).toBeNull();
  expect(errors).toEqual([]);
});
test("defense facility destruction fails and retry restores resources without rewards", async ({
  page,
}) => {
  await fixture(page, 4, 1);
  await launch(page, "최후의 통신소");
  const { s } = await play(page, "lose-defend");
  expect(s.result.reason).toBe("facility-lost");
  expect(s.facility.hp).toBe(0);
  await expect(page.getByRole("heading", { name: /작전 실패/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/phase7-defense-failure.png",
    fullPage: true,
  });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crater.campaign.v1")!),
  );
  expect(saved.completed).toHaveLength(4);
  expect(saved.supplies).toBe(800);
  await page.getByRole("button", { name: "임무 재도전" }).click();
  await page.clock.runFor(100);
  const retry = await snap(page);
  expect(retry.facility.hp).toBe(70);
  expect(retry.objective.reinforcement).toBe(0);
  expect(retry.completedRounds).toBe(0);
});
test("radar timeout is a failure, mobile HUD fits, and earned progress survives retry", async ({
  page,
}) => {
  await fixture(page, 5, 1);
  await launch(page, "적의 눈을 꺼라");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("작전 목표 HUD")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/phase7-mobile.png",
    fullPage: true,
  });
  const { s } = await play(page, "lose-radar");
  expect(s.result.reason).toBe("time-limit");
  expect(s.completedRounds).toBe(8);
  expect(s.facility.hp).toBe(65);
  expect(s.tanks[0].hp).toBeGreaterThan(0);
  await page.screenshot({
    path: "test-results/phase7-radar-failure.png",
    fullPage: true,
  });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crater.campaign.v1")!),
  );
  expect(saved.completed).toHaveLength(5);
  expect(saved.supplies).toBe(1150);
  await page.getByRole("button", { name: "임무 재도전" }).click();
  await page.clock.runFor(100);
  expect((await snap(page)).completedRounds).toBe(0);
  expect((await snap(page)).facility.hp).toBe(65);
});
