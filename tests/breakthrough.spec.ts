import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const ids = [
  "normandy",
  "iron",
  "last-line",
  "shadow",
  "last-signal",
  "blind-enemy",
  "convoy-fire",
  "iron-citadel",
];
const snap = (p: Page) => p.evaluate(() => (window as any).__CRATER_QA__());
async function range(p: Page, id: string, value: number) {
  await p.locator(id).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
async function fixture(p: Page, n: number, seed = 31) {
  await p.clock.install();
  await p.goto("/?seed=" + seed);
  await p.evaluate(
    ({ ids, n }) => {
      localStorage.setItem(
        "crater.campaign.v1",
        JSON.stringify({
          version: 1,
          current: ids[n],
          completed: ids.slice(0, n),
          grades: { normandy: "S", iron: "A", shadow: "S" },
          transitionSeen: true,
        }),
      );
      localStorage.setItem("crater.tutorial", "done");
      localStorage.setItem("crater.hint.mobility", "done");
    },
    { ids, n },
  );
  await p.reload();
  await p.getByRole("button", { name: /스토리 캠페인/ }).click();
}
async function launch(p: Page, title: string) {
  await p
    .locator(".mission-card")
    .filter({ has: p.getByRole("heading", { name: title, exact: true }) })
    .getByRole("button", { name: "브리핑 보기" })
    .click();
  await p.getByRole("button", { name: "작전 시작" }).click();
  await p.clock.runFor(100);
  const ok = p.getByRole("button", { name: "확인", exact: true });
  if (await ok.isVisible()) await ok.click();
}
async function shoot(p: Page, miss = false) {
  await p.getByRole("button", { name: "공격 무기", exact: true }).click();
  await p
    .getByRole("button", { name: "기본 폭발탄 선택", exact: true })
    .click();
  const plan = miss
    ? { angle: 10, power: 20 }
    : await p.evaluate(async () => {
        const s = (window as any).__CRATER_QA__();
        const path = "/src/game/engine.ts";
        const { solveShot } = await import(path);
        return solveShot(
          s.tanks[0],
          s.tanks[1],
          new Float64Array(s.terrain),
          s.wind,
          [...s.tanks, ...(s.facility ? [s.facility] : [])],
        );
      });
  await range(p, "#angle", plan.angle);
  await range(p, "#power", plan.power);
  await p.getByRole("button", { name: /발사!/ }).click();
}
async function play(
  p: Page,
  mode: "convoy" | "boss" | "lose-convoy" | "lose-boss",
) {
  const stages = new Set<number>(),
    waves = new Set<number>();
  let protectedOnce = false,
    moved = false,
    bomberSeen = false;
  const captured = new Set<string>();
  for (let i = 0; i < 850; i++) {
    const s = await snap(p);
    if (s.result) return { s, stages, waves, protectedOnce, moved, bomberSeen };
    if (s.convoy) waves.add(s.convoy.wave);
    if (s.boss) {
      for (const phase of s.boss.transitions) stages.add(phase);
      if (s.air?.kind === "bomber") bomberSeen = true;
    }
    if (s.scene) {
      if (!captured.has(s.scene.title)) {
        captured.add(s.scene.title);
        await p.screenshot({
          path:
            "test-results/phase8-" +
            (s.boss ? "boss-" + s.boss.phase : "wave-" + s.convoy.wave) +
            ".png",
        });
      }
      await p.getByRole("button", { name: "연출 건너뛰기" }).click();
    } else if (!s.convoy?.moving) {
      const defend = mode !== "lose-boss";
      if (defend && s.canEmp && mode !== "lose-convoy")
        await p.getByRole("button", { name: "EMP 방어", exact: true }).click();
      else if (
        defend &&
        s.canShield &&
        s.turn === "ai" &&
        ["deploy", "flight", "air", "drone"].includes(s.phase) &&
        (!s.boss || s.boss.phase === 3) &&
        (!s.convoy || s.convoy.wave === 2)
      )
        await p.keyboard.press("r");
      if (s.phase === "aim") {
        if (defend && s.tanks[0].hp <= 45 && s.canRepair) {
          await p
            .getByRole("button", { name: "방어 · 이동", exact: true })
            .click();
          await p.getByRole("button", { name: /긴급 정비/ }).click();
        } else if (
          mode === "convoy" &&
          s.convoy.wave === 1 &&
          !protectedOnce &&
          s.tanks[0].x < s.facility.x + 60 &&
          !moved
        ) {
          await p.locator("canvas").focus();
          const before = s.tanks[0].x;
          await p.keyboard.down("d");
          await p.clock.runFor(1200);
          await p.keyboard.up("d");
          moved = (await snap(p)).tanks[0].x > before;
          if (!moved) await shoot(p);
        } else if (
          mode === "convoy" &&
          s.convoy.wave === 1 &&
          !protectedOnce &&
          s.canProtectConvoy
        ) {
          await p.getByRole("button", { name: /호송 보호 · 방어막/ }).click();
          protectedOnce = true;
          await p.screenshot({
            path: "test-results/phase8-convoy-protect.png",
            fullPage: true,
          });
        } else
          await shoot(
            p,
            mode === "lose-boss" ||
              (mode === "lose-convoy" && s.convoy.wave > 0) ||
              (mode === "boss" && s.pendingAir?.owner === "ai"),
          );
      }
    }
    await p.clock.runFor(500);
  }
  throw Error(
    "Operation did not finish: " + JSON.stringify(await snap(p)).slice(0, 1500),
  );
}
test("six earned missions → real convoy waves → three-stage boss → eight saved victories", async ({
  page,
}) => {
  test.setTimeout(480000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fixture(page, 6);
  await expect(page.getByText("보급 점수 1550 · 완료 6/8")).toBeVisible();
  await page.screenshot({
    path: "test-results/phase8-campaign.png",
    fullPage: true,
  });
  await launch(page, "위험한 호송로");
  await expect(page.getByLabel("호송 작전 HUD")).toBeVisible();
  await page.screenshot({
    path: "test-results/phase8-convoy.png",
    fullPage: true,
  });
  const convoy = await play(page, "convoy");
  expect(convoy.s.result.reason).toBe("escorted");
  expect(convoy.waves.size).toBe(3);
  expect(convoy.s.convoy.kills).toBe(3);
  expect(convoy.s.convoy.checkpoint).toBe(5);
  expect(convoy.moved).toBe(true);
  expect(convoy.protectedOnce).toBe(true);
  // This seeded attack may miss: protection must not force an AI hit. Unit combat verifies actual absorption.
  expect(convoy.s.tanks[0].shields).toBeLessThan(2);
  await page.screenshot({
    path: "test-results/phase8-convoy-victory.png",
    fullPage: true,
  });
  let saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crater.campaign.v1")!),
  );
  expect(saved.supplies).toBe(2000);
  expect(saved.grades.normandy).toBe("S");
  expect(saved.unlocked).toHaveLength(8);
  await page.getByRole("button", { name: "다음 임무", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "철의 요새", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "작전 시작" }).click();
  await page.clock.runFor(100);
  await expect(page.locator("button.fire")).toBeDisabled();
  await page.screenshot({ path: "test-results/phase8-boss-intro.png" });
  const boss = await play(page, "boss");
  expect(boss.s.result.reason).toBe("boss-destroyed");
  expect([...boss.stages]).toEqual([1, 2, 3]);
  expect(boss.bomberSeen).toBe(true);
  expect(boss.s.supportStats.ai.bomber.shots).toBe(1);
  expect(boss.s.supportStats.ai.bomber.damage).toBeLessThanOrEqual(30);
  await expect(page.getByText(/NORTHERN FRONT COMPLETE · 8\/8/)).toBeVisible();
  await page.screenshot({
    path: "test-results/phase8-boss-victory.png",
    fullPage: true,
  });
  saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crater.campaign.v1")!),
  );
  expect(saved.supplies).toBe(2550);
  expect(saved.completed).toHaveLength(8);
  await page.getByRole("button", { name: "임무 재도전" }).click();
  await page.clock.runFor(100);
  const reset = await snap(page);
  expect(reset.boss.phase).toBe(1);
  expect(reset.boss.plates).toBe(3);
  expect(reset.tanks[0].hp).toBe(100);
  expect(reset.stats.shots).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: /스토리 캠페인/ }).click();
  await expect(page.getByText("보급 점수 2550 · 완료 8/8")).toBeVisible();
  expect(errors).toEqual([]);
});
test("actual convoy loss preserves six records and retry recreates truck and waves", async ({
  page,
}) => {
  test.setTimeout(240000);
  await fixture(page, 6, 1);
  await launch(page, "위험한 호송로");
  const result = await play(page, "lose-convoy");
  expect(result.s.result.outcome).toBe("defeat");
  expect(result.s.result.reason).toBe("convoy-lost");
  await page.screenshot({
    path: "test-results/phase8-convoy-failure.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("crater.campaign.v1")!).supplies,
    ),
  ).toBe(1550);
  await page.getByRole("button", { name: "임무 재도전" }).click();
  await page.clock.runFor(100);
  const s = await snap(page);
  expect(s.facility.hp).toBe(80);
  expect(s.convoy.wave).toBe(0);
  expect(s.convoy.checkpoint).toBe(0);
  expect(s.tanks[0].repairs).toBe(3);
});
test("actual boss loss, skippable intro, mobile HUD and retry retain seven rewards", async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, 7, 1);
  await launch(page, "철의 요새");
  await page.getByRole("button", { name: "연출 건너뛰기" }).click();
  await page.clock.runFor(50);
  await page.screenshot({
    path: "test-results/phase8-mobile-boss.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await play(page, "lose-boss");
  expect(result.s.result.outcome).toBe("defeat");
  expect(result.s.result.reason).toBe("player-lost");
  await page.screenshot({
    path: "test-results/phase8-boss-failure.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("crater.campaign.v1")!).supplies,
    ),
  ).toBe(2000);
  await page.getByRole("button", { name: "임무 재도전" }).click();
  await page.clock.runFor(100);
  const s = await snap(page);
  expect(s.boss.transitions).toEqual([1]);
  expect(s.boss.finalAttackUsed).toBe(false);
  expect(s.tanks[0].hp).toBe(100);
});
