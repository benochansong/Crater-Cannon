import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
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
async function enter(p: Page) {
  await p.clock.install();
  await p.goto("/?seed=31");
  await p.evaluate(() => localStorage.setItem("crater.hint.mobility", "done"));
  await p.getByRole("button", { name: /사격 훈련 FIRING RANGE/ }).click();
  await p.screenshot({ path: "test-results/phase9-training-menu.png" });
  await p.getByRole("button", { name: /TARGET A/ }).click();
  await p.clock.runFor(500);
}
async function settle(p: Page) {
  for (let i = 0; i < 20; i++) {
    await p.clock.runFor(1000);
    const s = await snap(p);
    expect(s.turn).toBe("player");
    expect(s.result).toBeNull();
    if (s.phase === "aim") {
      await p.clock.runFor(1000);
      return s;
    }
  }
  throw Error("Practice shot did not finish");
}
async function plan(p: Page) {
  return p.evaluate(async () => {
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
test("Firing range: lessons, five real predictions, three targets, records and restart", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await expect(page.locator("#angle")).toBeDisabled();
  await expect(page.locator("#power")).toBeEnabled();
  await range(page, "#power", 40);
  await page.getByRole("button", { name: "다음 학습" }).click();
  await expect(page.locator("#power")).toBeDisabled();
  await expect(page.locator("#angle")).toBeEnabled();
  await range(page, "#angle", 55);
  await page.getByRole("button", { name: "다음 학습" }).click();
  expect((await snap(page)).wind).toBe(3);
  await page.getByRole("button", { name: "자유 훈련 시작" }).click();
  const saved = await page.evaluate(() => ({
    campaign: localStorage.getItem("crater.campaign.v1"),
    free: localStorage.getItem("crater.records"),
  }));
  const comparisons: any[] = [];
  for (let i = 0; i < 5; i++) {
    if (i === 2) await page.getByLabel("훈련 목표").selectOption("B");
    if (i === 3) await page.getByLabel("훈련 목표").selectOption("C");
    await range(
      page,
      'input[aria-label="훈련 바람"]',
      i === 3 ? -3 : i === 4 ? 5 : 0,
    );
    const q = i === 0 ? { angle: 45, power: 25 } : await plan(page);
    await range(page, "#angle", q.angle);
    await range(page, "#power", q.power);
    await page.clock.runFor(500);
    const before = await snap(page),
      prediction = before.aiming.prediction;
    expect(prediction.impact).not.toBeNull();
    if (i === 3)
      await page.screenshot({
        path: "test-results/phase9-high-target.png",
        fullPage: true,
      });
    await page.locator("button.fire").click();
    await settle(page);
    const after = await snap(page),
      actual = after.history[0];
    expect(actual.impact.x).toBeCloseTo(prediction.impact.x, 6);
    expect(actual.impact.y).toBeCloseTo(prediction.impact.y, 6);
    expect(actual.impact.direct).toBe(prediction.impact.direct);
    expect(after.training.shots).toBe(i + 1);
    expect(after.tanks[0].hp).toBe(100);
    comparisons.push({
      shot: i + 1,
      target: before.config.training,
      angle: before.tanks[0].angle,
      power: before.tanks[0].power,
      wind: before.wind,
      predicted: prediction.impact,
      actual: actual.impact,
      error: Math.hypot(
        actual.impact.x - prediction.impact.x,
        actual.impact.y - prediction.impact.y,
      ),
    });
  }
  expect((await snap(page)).training.hits).toBeGreaterThanOrEqual(4);
  await page.screenshot({
    path: "test-results/phase9-training-results.png",
    fullPage: true,
  });
  const output = info.outputPath("prediction-comparison.json");
  await writeFile(output, JSON.stringify(comparisons, null, 2));
  await info.attach("Five actual shots", {
    path: output,
    contentType: "application/json",
  });
  await page.getByRole("button", { name: "훈련 다시 시작" }).click();
  expect((await snap(page)).training.shots).toBe(0);
  expect((await snap(page)).history).toHaveLength(0);
  await page.getByRole("button", { name: "크레이터 캐논 메인 메뉴" }).click();
  await expect(page.getByRole("button", { name: "게임 시작" })).toBeVisible();
  const storage = await page.evaluate(() => ({
    campaign: localStorage.getItem("crater.campaign.v1"),
    free: localStorage.getItem("crater.records"),
    training: JSON.parse(localStorage.getItem("crater.training.v1") || "[]"),
  }));
  expect(storage.campaign).toBe(saved.campaign);
  expect(storage.free).toBe(saved.free);
  expect(storage.training[0].shots).toBe(5);
  await page.reload();
  await page.getByRole("button", { name: /사격 훈련 FIRING RANGE/ }).click();
  await expect(page.getByText(/최근 훈련: 5발/)).toBeVisible();
  expect(errors).toEqual([]);
});
test("Guide settings persist and use actual mission difficulty; movement refreshes cache", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/?seed=31");
  await page.evaluate(() =>
    localStorage.setItem("crater.hint.mobility", "done"),
  );
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  await page.getByLabel("AI 난이도").selectOption("hard");
  await page.getByRole("button", { name: "완료" }).click();
  await page.getByRole("button", { name: "게임 시작" }).click();
  await page.clock.runFor(400);
  await expect(page.getByLabel("조준 분석")).toContainText("방향 가이드");
  expect((await snap(page)).aiming.prediction.impact).toBeNull();
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  await page.getByLabel("조준 보조").selectOption("extended");
  await page.getByRole("button", { name: "완료" }).click();
  await page.clock.runFor(100);
  expect((await snap(page)).assisted).toBe(true);
  expect((await snap(page)).aiming.prediction.impact).not.toBeNull();
  const before = await snap(page);
  await page.locator("canvas").focus();
  await page.keyboard.down("d");
  await page.clock.runFor(700);
  await page.keyboard.up("d");
  await page.clock.runFor(400);
  const after = await snap(page);
  expect(after.tanks[0].x).toBeGreaterThan(before.tanks[0].x);
  expect(after.aiming.prediction.setup.muzzle.x).not.toBe(
    before.aiming.prediction.setup.muzzle.x,
  );
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  await page.getByLabel("조준 보조").selectOption("off");
  await page.getByRole("button", { name: "완료" }).click();
  await page.clock.runFor(100);
  expect((await snap(page)).aiming.prediction).toBeNull();
  await page.getByRole("button", { name: "크레이터 캐논 메인 메뉴" }).click();
  await page.reload();
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  await expect(page.getByLabel("조준 보조")).toHaveValue("off");
  await page.getByLabel("조준 보조").selectOption("default");
  await page.getByRole("button", { name: "완료" }).click();
  await page.getByRole("button", { name: /스토리 캠페인/ }).click();
  await page
    .locator(".mission-card")
    .first()
    .getByRole("button", { name: "브리핑 보기" })
    .click();
  await page.getByRole("button", { name: "작전 시작" }).click();
  await page.clock.runFor(200);
  await expect(page.getByLabel("조준 분석")).toContainText("전체 예측");
  expect((await snap(page)).aiming.prediction.impact).not.toBeNull();
  await page.screenshot({
    path: "test-results/phase9-campaign-guide.png",
    fullPage: true,
  });
});
test("Mobile training remains operable and shot history keeps three world-space markers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.getByRole("button", { name: "학습 건너뛰기" }).click();
  for (let i = 0; i < 4; i++) {
    await range(page, "#angle", 45 + i * 4);
    await range(page, "#power", 25 + i * 2);
    await page.locator("button.fire").click();
    await settle(page);
  }
  const s = await snap(page);
  expect(s.history.map((r: any) => r.sequence)).toEqual([4, 3, 2]);
  await expect(page.getByLabel("조준 분석")).toContainText("이전 실제 사격");
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.viewport + 1);
  await page.screenshot({
    path: "test-results/phase9-mobile.png",
    fullPage: true,
  });
});
test("All menu actions fit inside the arena on desktop and mobile", async ({
  page,
}) => {
  for (const [width, height] of [
    [1366, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?seed=31");
    const arena = await page.locator(".arena").boundingBox();
    for (const button of await page.locator(".menu-actions button").all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(arena!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(arena!.x + arena!.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        arena!.y + arena!.height,
      );
    }
    await page.screenshot({
      path: "test-results/phase9-menu-" + width + ".png",
      fullPage: true,
    });
  }
});
