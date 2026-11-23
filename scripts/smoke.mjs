import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { firefox } from "@playwright/test";
import assert from "node:assert/strict";
const port = 4188;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Preview startup timed out")),
      15000,
    );
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes(String(port))) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Preview exited: ${code}`));
    });
  });
  browser = await firefox.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(origin) && !r.url().startsWith("data:"))
      external.push(r.url());
  });
  await page.goto(origin);
  await page.getByRole("button", { name: "게임 시작" }).waitFor();
  assert.equal(
    await page.evaluate(() => "__CRATER_QA__" in window),
    false,
    "QA bridge must not ship",
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/production-menu.png" });
  await page.getByRole("button", { name: "게임 시작" }).click();
  await page.screenshot({ path: "test-results/production-battle.png" });
  await page.getByRole("button", { name: /발사!/ }).click();
  await page.getByRole("button", { name: /대기 중/ }).waitFor();
  await page
    .locator(".turn-banner")
    .filter({ hasText: "상대 차례" })
    .waitFor({ timeout: 18000 });
  await page.getByRole("button", { name: "크레이터 캐논 메인 메뉴" }).click();
  await page.getByRole("button", { name: /사격 훈련 FIRING RANGE/ }).click();
  await page.getByRole("button", { name: /TARGET A/ }).click();
  await page.getByRole("button", { name: "학습 건너뛰기" }).click();
  await page.locator("button.fire").click();
  await page
    .locator(".shot-history")
    .filter({ hasText: "#1" })
    .waitFor({ timeout: 18000 });
  assert.match(await page.locator(".training-stats").innerText(), /발사\s*1/);
  await page.screenshot({
    path: "test-results/production-training.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "Production smoke passed: menu, fire, AI turn, training shot/history, no page errors, no external requests, QA bridge absent.",
  );
} finally {
  await browser?.close();
  server.kill();
}
