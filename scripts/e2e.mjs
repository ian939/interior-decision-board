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
    const conversation = page.locator(".detail-section").filter({ has: page.getByRole("heading", { name: /우리의 이야기/ }) });
    await conversation.getByRole("button", { name: "이미지 첨부" }).waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(outputDir, "03-card-drawer.png"), fullPage: true });
    await page.getByRole("button", { name: "자료 삭제" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "이 자료를 삭제할까요?" });
    await deleteDialog.waitFor();
    await page.screenshot({ path: resolve(outputDir, "03b-card-delete-confirmation.png"), fullPage: true });
    await deleteDialog.getByRole("button", { name: "취소" }).click();
    await page.getByRole("button", { name: "닫기" }).last().click();
  }
  await page.getByRole("button", { name: /도면·아이디어/ }).click();
  await page.getByRole("heading", { name: "도면과 기존 아이디어" }).waitFor();
  const floorPlan = page.getByAltText("공사 포인트가 표시된 평면도");
  await floorPlan.waitFor();
  if (!(await floorPlan.evaluate((image) => image.classList.contains("mirrored-plan-image")))) throw new Error("도면이 실제 방향(좌우 반전)으로 열리지 않았습니다.");
  await page.getByRole("button", { name: "원본 방향" }).click();
  if (await floorPlan.evaluate((image) => image.classList.contains("mirrored-plan-image"))) throw new Error("원본 방향 전환이 적용되지 않았습니다.");
  await page.getByRole("button", { name: /실제 방향/ }).click();
  if (!(await floorPlan.evaluate((image) => image.classList.contains("mirrored-plan-image")))) throw new Error("실제 방향 복원이 적용되지 않았습니다.");
  await floorPlan.locator("xpath=..").click();
  const previewPlan = page.getByRole("dialog").getByAltText("공사 포인트가 표시된 평면도");
  await previewPlan.waitFor();
  if (!(await previewPlan.evaluate((image) => image.classList.contains("mirrored-plan-image")))) throw new Error("확대 보기에서 실제 방향이 유지되지 않았습니다.");
  await page.getByRole("button", { name: "닫기" }).click();
  await page.screenshot({ path: resolve(outputDir, "05-references-plans-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: /디자인·아이디어/ }).click();
  await page.getByRole("heading", { name: "인출식 + 폭포수 모드 주방 수전" }).waitFor();
  await page.screenshot({ path: resolve(outputDir, "06-references-ideas-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: /슬라이드 7 보기/ }).click();
  await page.getByRole("heading", { name: "주방 수전 · 아일랜드 설비" }).waitFor();
  await page.screenshot({ path: resolve(outputDir, "07-references-brief-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: /배치 실험실/ }).click();
  await page.getByRole("heading", { name: "가구 배치 실험실" }).waitFor();
  const firstLayoutButton = page.getByRole("button", { name: "배치안 1 만들기" });
  if (await firstLayoutButton.isVisible()) await firstLayoutButton.click();
  else await page.getByRole("button", { name: /새 배치안/ }).click();
  const layoutName = page.getByLabel("배치안 이름");
  await layoutName.waitFor();
  await page.locator(".floor-plan-vector").waitFor();
  if (await page.locator(".floor-dimension").count() < 10) throw new Error("도면 외곽 치수선이 충분히 표시되지 않았습니다.");
  await page.getByRole("button", { name: "원본 대조" }).click();
  await page.locator(".planner-source-overlay").waitFor();
  await page.getByRole("button", { name: "원본 대조" }).click();
  await layoutName.fill("E2E 배치안");
  await page.getByRole("button", { name: /3인 소파/ }).click();
  await page.getByRole("button", { name: /식탁 4인/ }).click();
  await page.getByRole("heading", { name: "치수와 배치" }).waitFor();
  await page.locator(".planner-item.colliding").first().waitFor();
  if (await page.locator(".planner-item.colliding").count() < 2) throw new Error("겹침 표시가 두 가구에 적용되지 않았습니다.");
  await page.locator(".planner-clearance").waitFor();
  await page.getByRole("button", { name: "90° 회전" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByText("저장됨", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(outputDir, "09-space-planner-desktop.png"), fullPage: true });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "배치안 삭제" }).click();
  const token = await page.evaluate(() => localStorage.getItem("interior-decision-token"));
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.addInitScript((value) => localStorage.setItem("interior-decision-token", value), token);
  const mobilePage = await mobile.newPage();
  await mobilePage.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded" });
  await mobilePage.getByText("오늘은 무엇을 결정할까요?").waitFor();
  await mobilePage.screenshot({ path: resolve(outputDir, "04-board-mobile.png"), fullPage: true });
  await mobilePage.getByRole("button", { name: "메뉴 열기" }).click();
  await mobilePage.getByRole("button", { name: /도면·아이디어/ }).click();
  await mobilePage.getByRole("heading", { name: "도면과 기존 아이디어" }).waitFor();
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({ path: resolve(outputDir, "08-references-mobile.png"), fullPage: true });
  await mobilePage.getByRole("button", { name: "메뉴 열기" }).click();
  await mobilePage.getByRole("button", { name: /배치 실험실/ }).click();
  await mobilePage.getByRole("heading", { name: "가구 배치 실험실" }).waitFor();
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({ path: resolve(outputDir, "10-space-planner-mobile.png"), fullPage: true });
  await mobile.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        assertions: ["login", "desktop_board", "card_drawer", "story_image_picker", "card_delete_confirmation", "mobile_board", "reference_plans", "reference_plan_orientation", "reference_ideas", "reference_brief", "reference_mobile", "space_planner_create", "space_planner_vector_plan", "space_planner_dimensions", "space_planner_source_overlay", "space_planner_edit", "space_planner_collision", "space_planner_clearance", "space_planner_save", "space_planner_delete", "space_planner_mobile"],
        outputDir,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
