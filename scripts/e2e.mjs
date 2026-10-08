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
  const planAlts = [
    "한신무학 아파트 원래 평면도",
    "가구 없이 보일러와 안쪽 여닫이문을 표시한 구조 평면도",
    "방문이 안쪽으로 열리고 간접조명과 매립등 위치가 표시된 조명 계획도",
    "방문이 안쪽으로 열리고 조명과 콘센트 제안 위치가 표시된 전기 계획도",
  ];
  for (const alt of planAlts) await page.getByAltText(alt).waitFor();
  const planCards = page.locator(".floorplan-card");
  if (await planCards.count() !== 4) throw new Error("원본·구조·조명·콘센트 도면 4종이 모두 표시되지 않습니다.");
  const expectedPlanFiles = ["floorplan-final.png", "floorplan-structure-boiler.png", "floorplan-lighting-inward-doors.png", "floorplan-lighting-outlets-inward-doors.png"];
  for (let index = 0; index < expectedPlanFiles.length; index += 1) {
    const src = await planCards.nth(index).locator("img").getAttribute("src");
    if (!src?.includes(expectedPlanFiles[index])) throw new Error(`도면 ${index + 1}의 순서 또는 이미지가 올바르지 않습니다.`);
  }
  if (await page.locator(".renovation-points article").count() !== 7) throw new Error("공사 포인트 1~7 목록이 모두 표시되지 않습니다.");
  const outletPlan = page.getByAltText(planAlts[3]);
  if (!(await outletPlan.getAttribute("src"))?.includes("floorplan-lighting-outlets-inward-doors.png")) throw new Error("조명+콘센트 도면 이미지가 올바르지 않습니다.");
  await outletPlan.locator("xpath=..").click();
  await page.getByRole("dialog").getByAltText(planAlts[3]).waitFor();
  await page.getByRole("button", { name: "닫기" }).click();
  await page.screenshot({ path: resolve(outputDir, "05-references-plans-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: /디자인·아이디어/ }).click();
  if (await page.getByRole("heading", { name: "TV월플렉스 + 홈카페 거실 적용 검토" }).count()) throw new Error("원복한 거실 적용 검토가 남아 있습니다.");
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
  await page.locator(".planner-final-plan").waitFor();
  const finalPlanImage = page.locator(".planner-final-plan image");
  await finalPlanImage.waitFor();
  const finalPlanHref = await finalPlanImage.getAttribute("href");
  if (!finalPlanHref?.includes("floorplan-structure-boiler.png")) throw new Error("보일러 포함 구조 평면도가 배치 실험실에 표시되지 않습니다.");
  if (await page.getByRole("button", { name: /요청 반영안/ }).count()) throw new Error("제거하기로 한 변경안 버튼이 남아 있습니다.");
  if (await page.locator(".floor-plan-vector").count()) throw new Error("폐기한 벡터 변경안이 남아 있습니다.");
  if (await page.getByRole("button", { name: "블로그 거실 세트 배치" }).count()) throw new Error("원복한 블로그 거실 세트 버튼이 남아 있습니다.");
  await layoutName.fill("E2E 배치안");
  await page.getByRole("button", { name: /3인 소파/ }).click();
  await page.getByRole("button", { name: /식탁 4인/ }).click();
  await page.getByRole("heading", { name: "치수와 배치" }).waitFor();
  const furnitureName = page.getByLabel("가구 이름");
  await furnitureName.fill("");
  if (await furnitureName.inputValue() !== "") throw new Error("가구 이름을 완전히 지울 수 없습니다.");
  await furnitureName.fill("테스트 테이블");
  const furnitureWidth = page.getByLabel("가구 가로");
  await furnitureWidth.fill("");
  if (await furnitureWidth.inputValue() !== "") throw new Error("가구 가로 값을 완전히 지울 수 없습니다.");
  await furnitureWidth.fill("1350");
  await furnitureWidth.blur();
  const furnitureDepth = page.getByLabel("가구 세로");
  await furnitureDepth.fill("");
  if (await furnitureDepth.inputValue() !== "") throw new Error("가구 세로 값을 완전히 지울 수 없습니다.");
  await furnitureDepth.fill("780");
  await furnitureDepth.blur();
  const furnitureColor = page.getByLabel("가구 색상");
  await furnitureColor.fill("#4f7b68");
  if (await furnitureColor.inputValue() !== "#4f7b68") throw new Error("가구 색상이 변경되지 않았습니다.");
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
        assertions: ["login", "desktop_board", "card_drawer", "story_image_picker", "card_delete_confirmation", "mobile_board", "reference_plan_grid_order", "reference_plan_grid_preview", "reference_construction_points", "living_fit_removed", "reference_ideas", "reference_brief", "reference_mobile", "space_planner_create", "space_planner_renovation_plan_1", "space_planner_single_plan", "space_planner_change_variant_removed", "space_planner_homecafe_removed", "space_planner_edit", "space_planner_clearable_inputs", "space_planner_color", "space_planner_collision", "space_planner_clearance", "space_planner_save", "space_planner_delete", "space_planner_mobile"],
        outputDir,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
