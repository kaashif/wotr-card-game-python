import { expect, test } from "@playwright/test";

test.describe("real game table UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders real engine state at the four-player table", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "War of the Ring" })).toBeVisible();
    await expect(page.getByText("Round 1 - Action - seed middle-earth")).toBeVisible();

    await expect(page.getByLabel("Aragorn seat")).toContainText("Free Peoples -");
    await expect(page.getByLabel("Witch-king seat")).toContainText("Shadow -");
    await expect(page.getByLabel("Frodo seat")).toContainText("Free Peoples -");
    await expect(page.getByLabel("Saruman seat")).toContainText("Shadow -");

    const table = page.getByLabel("Play area");
    await expect(table.locator(".battleground-zone .zone-title span")).toHaveText(
      "Battleground",
    );
    await expect(table.locator(".path-zone .zone-title span")).toHaveText("Path");
    await expect(table.locator(".battleground-zone .zone-title small")).toContainText(
      "Defense",
    );
    await expect(table.locator(".battleground-zone .zone-title small")).toContainText(
      "VP",
    );
    await expect(table.locator(".game-card.table")).toHaveCount(0);
  });

  test("selects a real card and updates the selected-card inspector", async ({ page }) => {
    const firstHandCard = page.locator(".game-card.hand").first();
    await expect(firstHandCard).toBeVisible();

    const title = await firstHandCard.locator("strong").innerText();
    await firstHandCard.click();

    const selection = page.getByLabel("Event log").locator(".selection");
    await expect(selection).toContainText(title);
    await expect(selection).not.toContainText("No card selected");
  });

  test("executes a real engine action and appends the game log", async ({ page }) => {
    await page.locator("[data-action='ring']").click();

    await expect(page.getByLabel("Event log")).toContainText(
      "Frodo used a ring token and drew 2 cards.",
    );
    await expect(page).toHaveURL(/\/wotr-card-game-python\/$/);
  });

  test("shows a stable long-hover preview for a real card", async ({ page }) => {
    const firstHandCard = page.locator(".game-card.hand").first();
    await expect(firstHandCard).toBeVisible();

    const title = await firstHandCard.locator("strong").innerText();
    const rulesText = await firstHandCard.locator("p").innerText();
    await firstHandCard.hover();

    const preview = page.getByLabel("Card preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(title);
    await expect(preview).toContainText(rulesText);

    await page.waitForTimeout(1_500);
    await expect(preview).toHaveCount(1);

    await page.mouse.move(12, 12);
    await expect(preview).toHaveCount(0);
  });

  test("keeps the real game usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/");

    await expect(page.getByLabel("Aragorn seat")).toBeVisible();
    await expect(page.getByLabel("Play area")).toBeVisible();
    await expect(page.locator(".game-card.hand").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Resolve" })).toBeVisible();
  });
});
