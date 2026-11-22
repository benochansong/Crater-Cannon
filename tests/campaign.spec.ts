import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const snap = (page: Page) =>
  page.evaluate(() => (window as any).__CRATER_QA__());
async function range(page: Page, id: string, value: number) {
  await page.locator(id).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
async function aim(page: Page) {
  return page.evaluate(async () => {
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
}
async function win(page: Page, number: number) {
  for (let i = 0; i < 600; i++) {
    const s = await snap(page);
    if (s.result) {
      expect(s.result.outcome).toBe("victory");
      expect(s.result.enemyHp).toBe(0);
      return s;
    }
    if (s.canEmp)
      await page.getByRole("button", { name: "EMP 방어", exact: true }).click();
    else if (
      s.canShield &&
      s.turn === "ai" &&
      ["deploy", "flight", "air", "drone"].includes(s.phase)
    )
      await page.keyboard.press("r");
    if (s.phase === "aim") {
      if (s.tanks[0].hp <= 45 && s.canRepair) {
        await page
          .getByRole("button", { name: "방어 · 이동", exact: true })
          .click();
        await page.getByRole("button", { name: /긴급 정비|야전 수리/ }).click();
      } else {
        await page
          .getByRole("button", { name: "공격 무기", exact: true })
          .click();
        const ap = s.config.weapons.includes("ap") && s.tanks[0].ammo.ap > 0;
        await page
          .getByRole("button", {
            name: ap
              ? "철갑탄 선택"
              : s.config.era === "ww2"
                ? "고폭탄 (HE) 선택"
                : "기본 폭발탄 선택",
          })
          .click();
        const p = await aim(page);
        await range(page, "#angle", p.angle);
        await range(page, "#power", p.power);
        await page.getByRole("button", { name: /발사!/ }).click();
      }
    }
    await page.clock.runFor(500);
  }
  throw Error("Mission " + number + " did not end");
}
test("campaign: four real victories, ordered unlocks, era transition, persistent grade and replay reset", async ({
  page,
}) => {
  test.setTimeout(360000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=31");
  await page.getByRole("button", { name: /스토리 캠페인/ }).click();
  await expect(page.locator(".mission-card")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "잠김" })).toHaveCount(2);
  await page.screenshot({
    path: "test-results/phase5-campaign.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "브리핑 보기" }).click();
  await expect(
    page.getByRole("heading", { name: "노르망디의 포성" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/phase5-briefing.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "작전 시작" }).click();
  await page.clock.install();
  await page.clock.runFor(100);
  for (let n = 1; n <= 4; n++) {
    let s = await snap(page);
    expect(s.tanks[0].hp).toBe(100);
    expect(s.stats.shots).toBe(0);
    if (n <= 3) {
      expect(s.config.era).toBe("ww2");
      await expect(
        page.getByRole("button", { name: "EMP 방어", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "공격 드론 선택" }),
      ).toHaveCount(0);
      await page.locator("canvas").focus();
      await page.keyboard.press("5");
      await page.keyboard.press("e");
      await page.keyboard.press("r");
      s = await snap(page);
      expect(s.tanks[0].shield).toBe(false);
      expect(s.tanks[0].ammo.missile).toBe(0);
    } else expect(s.config.era).toBe("modern");
    await page.screenshot({
      path: "test-results/phase5-mission-" + n + ".png",
    });
    s = await win(page, n);
    if (n === 3) expect(s.breachProgress).toBe(1);
    await expect(
      page.getByRole("heading", { name: /작전 성공/ }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/phase5-result-" + n + ".png",
      fullPage: true,
    });
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("crater.campaign.v1")!),
    );
    expect(saved.completed).toHaveLength(n);
    if (n < 3) {
      await page
        .getByRole("button", { name: "다음 임무", exact: true })
        .click();
      await page.getByRole("button", { name: "작전 시작" }).click();
    } else if (n === 3) {
      await page.getByRole("button", { name: "다음 시대의 이야기" }).click();
      await expect(
        page.getByRole("region", { name: "시대 전환" }),
      ).toBeVisible();
      await page.clock.runFor(8500);
      await page.screenshot({ path: "test-results/phase5-transition.png" });
      await page.getByRole("button", { name: /건너뛰고 현대전/ }).click();
      await expect(
        page.getByRole("heading", { name: "드론의 그림자" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "작전 시작" }).click();
    }
    await page.clock.runFor(100);
  }
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crater.campaign.v1")!),
  );
  expect(
    await page.evaluate(() => localStorage.getItem("crater.records")),
  ).toBeNull();
  expect(saved.supplies).toBe(800);
  expect(saved.transitionSeen).toBe(true);
  await page.getByRole("button", { name: "임무 재도전" }).click();
  let s = await snap(page);
  expect(s.tanks[0].hp).toBe(100);
  expect(s.tanks[0].ammo.drone).toBe(2);
  expect(s.tanks[0].shields).toBe(2);
  expect(s.stats.shots).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: /스토리 캠페인/ }).click();
  await expect(page.getByText("보급 점수 800 · 완료 4/4")).toBeVisible();
  await page.getByRole("button", { name: /자유 전투로 이동/ }).click();
  s = await snap(page);
  expect(s.config.missionId).toBeUndefined();
  expect(s.tanks[0].airRemaining).toBe(1);
  expect(errors).toEqual([]);
});
test("corrupt campaign data preserves settings and legacy records; mobile screens remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("crater.campaign.v1", "{bad");
    localStorage.setItem(
      "crater.settings",
      JSON.stringify({
        volume: 0.4,
        muted: true,
        shake: false,
        difficulty: "hard",
        autoEmp: true,
      }),
    );
    localStorage.setItem("crater.records", "[]");
  });
  await page.reload();
  await page.getByRole("button", { name: /스토리 캠페인/ }).click();
  await expect(page.getByRole("button", { name: "잠김" })).toHaveCount(2);
  await page.screenshot({
    path: "test-results/phase5-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "브리핑 보기" }).click();
  await page.getByRole("button", { name: "작전 시작" }).click();
  await expect(page.getByRole("button", { name: "철갑탄 선택" })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("crater.settings")!).difficulty,
    ),
  ).toBe("hard");
  expect(
    await page.evaluate(() => localStorage.getItem("crater.records")),
  ).toBe("[]");
});
async function savedMission(
  page: Page,
  completed: string[],
  era: "ww2" | "modern",
) {
  await page.goto("/?seed=31");
  await page.evaluate(
    (ids) =>
      localStorage.setItem(
        "crater.campaign.v1",
        JSON.stringify({
          version: 1,
          completed: ids,
          current: ids.length === 3 ? "shadow" : "last-line",
          grades: {},
          transitionSeen: false,
        }),
      ),
    completed,
  );
  await page.reload();
  await page.getByRole("button", { name: /스토리 캠페인/ }).click();
  if (era === "modern")
    await page.getByRole("button", { name: /2020s · 가상의 현대전/ }).click();
  await page.getByRole("button", { name: "브리핑 보기" }).click();
}
async function until(page: Page, condition: (s: any) => boolean) {
  for (let i = 0; i < 300; i++) {
    if (condition(await snap(page))) return;
    await page.clock.runFor(200);
  }
  throw Error("Expected action did not finish");
}
test("WWII UI: smoke, cover, artillery and propeller support use their own resources", async ({
  page,
}) => {
  await savedMission(page, ["normandy", "iron"], "ww2");
  await page.getByRole("button", { name: "작전 시작" }).click();
  await page.clock.install();
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "방어 · 이동", exact: true }).click();
  await expect(page.getByRole("button", { name: /에너지 방어막/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /연막 ·/ }).click();
  expect((await snap(page)).tanks[0].smokes).toBe(1);
  await page.screenshot({ path: "test-results/phase5-smoke.png" });
  await until(page, (s) => s.phase === "aim");
  await page.getByRole("button", { name: /엄폐 ·/ }).click();
  await page.screenshot({ path: "test-results/phase5-cover.png" });
  await until(page, (s) => s.phase === "aim");
  expect((await snap(page)).tanks[0].covers).toBe(1);
  for (const [name, kind] of [
    ["포병 지원", "artillery"],
    ["프로펠러 공격기", "propeller"],
  ]) {
    await page.getByRole("button", { name: "항공 지원", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "공격 헬기 선택" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: name + " 선택" }).click();
    await page.getByRole("button", { name: "적 위치에 구역 지정" }).click();
    await page.getByRole("button", { name: /지원 요청/ }).click();
    await until(page, (s) => s.air?.owner === "player");
    await page.clock.runFor(1800);
    await page.screenshot({ path: "test-results/phase5-" + kind + ".png" });
    await until(page, (s) => s.phase === "aim" || !!s.result);
    expect((await snap(page)).supportStats.player[kind].shots).toBe(1);
  }
  expect((await snap(page)).tanks[0].airRemaining).toBe(0);
});
test("automatic transition and actual failed mission retry keep earned progress", async ({
  page,
}) => {
  await page.clock.install();
  await savedMission(page, ["normandy", "iron", "last-line"], "modern");
  await page.clock.runFor(16500);
  await expect(
    page.getByRole("heading", { name: "드론의 그림자" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "작전 시작" }).click();
  for (let i = 0; i < 600; i++) {
    const s = await snap(page);
    if (s.result) break;
    if (s.phase === "aim") {
      await range(page, "#angle", 10);
      await range(page, "#power", 20);
      await page.getByRole("button", { name: /발사!/ }).click();
    }
    await page.clock.runFor(500);
  }
  expect((await snap(page)).result?.outcome).toBe("defeat");
  await expect(page.getByRole("heading", { name: /작전 실패/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/phase5-failure.png",
    fullPage: true,
  });
  const p = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crater.campaign.v1")!),
  );
  expect(p.completed).toHaveLength(3);
  expect(p.supplies).toBe(500);
  await page.getByRole("button", { name: "임무 재도전" }).click();
  const s = await snap(page);
  expect(s.config.missionId).toBe("shadow");
  expect(s.tanks[0].hp).toBe(100);
  expect(s.tanks[0].ammo.drone).toBe(2);
  expect(s.tanks[0].emp).toBe(2);
  expect(s.tanks[0].shield).toBe(false);
});
