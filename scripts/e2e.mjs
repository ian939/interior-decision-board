import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDir = resolve(projectRoot, ".tmp", "e2e");
const executablePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const password = process.env.E2E_OWNER_PASSWORD;
if (!password) throw new Error("E2E_OWNER_PASSWORD 환경 변수가 필요합니다.");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  await page.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: resolve(outputDir, "01-login.png"), fullPage: true });
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: /들어가기/ }).click();
  await page.getByText("오늘은 무엇을 결정할까요?").waitFor();
  await page.screenshot({ path: resolve(outputDir, "02-board-desktop.png"), fullPage: true });
  const card = page.locator(".decision-card").first();
  if (await card.count()) {
    await card.click();
    await page.locator(".card-drawer").waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(outputDir, "03-card-drawer.png"), fullPage: true });
    await page.getByRole("button", { name: "닫기" }).last().click();
  }
  const token = await page.evaluate(() => localStorage.getItem("interior-decision-token"));
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.addInitScript((value) => localStorage.setItem("interior-decision-token", value), token);
  const mobilePage = await mobile.newPage();
  await mobilePage.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await mobilePage.getByText("오늘은 무엇을 결정할까요?").waitFor();
  await mobilePage.screenshot({ path: resolve(outputDir, "04-board-mobile.png"), fullPage: true });
  await mobile.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        assertions: ["login", "desktop_board", "card_drawer", "mobile_board"],
        outputDir,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
