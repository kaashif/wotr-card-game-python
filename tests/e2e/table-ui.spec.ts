import { expect, test } from "@playwright/test";

test.describe("standalone table UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the four-player table with real location text", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "War of the Ring" })).toBeVisible();

    await expect(page.getByLabel("Aragorn seat")).toContainText("Free Peoples - 5 cards");
    await expect(page.getByLabel("Witch-king seat")).toContainText("Shadow - 5 cards");
    await expect(page.getByLabel("Frodo seat")).toContainText("Free Peoples - 6 cards");
    await expect(page.getByLabel("Saruman seat")).toContainText("Shadow - 7 cards");

    const table = page.getByLabel("Play area");
    await expect(table.getByText("Minas Tirith", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Dunedain player MAY forsake 1 card to draw 3 cards."),
    ).toBeVisible();
    await expect(table.getByText("Cirith Ungol", { exact: true })).toBeVisible();
    await expect(
      page.getByText("The Mordor player draws 5 cards, may play 1 Army and cycles rest."),
    ).toBeVisible();
  });

  test("selects a card and updates the selected-card inspector", async ({ page }) => {
    await page.locator("[data-card-id='black-captain']").click();

    const selection = page.getByLabel("Event log").locator(".selection");
    await expect(selection).toContainText("The Black Captain");
    await expect(selection).toContainText("(re)activate any Mordor battleground");
    await expect(page.getByLabel("Witch-king seat")).toHaveClass(/active/);
  });

  test("logs mock actions without leaving the page", async ({ page }) => {
    await page.getByRole("button", { name: "Resolve" }).click();

    await expect(page.getByLabel("Event log")).toContainText(
      "Combat resolves at Minas Tirith; committed cards pulse on the felt.",
    );
    await expect(page).toHaveURL(/\/wotr-card-game-python\/$/);
  });

  test("shows a stable long-hover card preview with full text", async ({ page }) => {
    await page.locator("[data-card-id='black-captain']").hover();
    const preview = page.getByLabel("Card preview");

    await expect(preview).toBeVisible();
    await expect(preview).toContainText("The Black Captain");
    await expect(preview).toContainText(
      "If the Witch-King is in reserve (active or not), (re)activate any Mordor battleground, then you MAY move the Witch-King to this battleground.",
    );

    await page.waitForTimeout(1_500);
    await expect(preview).toHaveCount(1);

    await page.mouse.move(12, 12);
    await expect(preview).toHaveCount(0);
  });

  test("keeps the mobile layout usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/");

    await expect(page.getByLabel("Aragorn seat")).toBeVisible();
    await expect(page.getByText("Anduril")).toBeVisible();
    await expect(
      page.getByLabel("Play area").getByText("Minas Tirith", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Resolve" })).toBeVisible();
  });
});
