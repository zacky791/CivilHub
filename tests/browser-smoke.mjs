import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1512, height: 1050 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("outputs", { recursive: true });
const url = "http://127.0.0.1:5173/";
const dialog = () => page.getByRole("dialog").last();
const check = async (text) => {
  await page.getByText(text, { exact: false }).first().waitFor();
};
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: "outputs/desktop.png", fullPage: true });
  assert.match(
    await page.getByRole("heading", { level: 1 }).innerText(),
    /Choose a company/,
  );
  await page.locator(".company-card").first().click();
  await dialog().locator("select").first().selectOption("Other");
  await dialog().locator("input[name=customWork]").fill("Drainage improvement");
  await dialog().locator("input[name=client]").fill("QA Construction");
  await dialog().locator("input[name=price]").fill("15000.00");
  await dialog().locator("input[name=location]").fill("Shah Alam, Selangor");
  await dialog().locator("input[name=date]").fill("2026-11-03");
  await dialog().locator("textarea").fill("Browser verification project");
  await dialog().getByRole("button", { name: "Pin on map" }).click();
  await page.locator(".leaflet-container").waitFor();
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 180, y: 90 } });
  await dialog().getByRole("button", { name: "Save job", exact: true }).click();
  await check("registered successfully");
  let job = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("civilhub:workspace:v1")).jobs.find(
      (j) => j.client === "QA Construction",
    ),
  );
  assert.equal(job.price, 1500000);
  assert.equal(job.workType, "Drainage improvement");
  await page
    .locator(".sidebar nav")
    .getByRole("link", { name: "Dashboard" })
    .click();
  await page.getByRole("button", { name: job.number, exact: true }).click();
  await dialog()
    .locator("input[type=file]")
    .setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZryAAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await check("1 attachment saved");
  await dialog()
    .getByRole("button", { name: "receipt.png", exact: true })
    .click();
  await dialog().locator(".file-preview img").waitFor();
  const downloadPromise = page.waitForEvent("download");
  await dialog().getByRole("button", { name: "Download receipt.png" }).click();
  assert.equal((await downloadPromise).suggestedFilename(), "receipt.png");
  await dialog().getByRole("button", { name: "Manage expenses" }).click();
  await page
    .getByRole("button", { name: "Add expense", exact: true })
    .first()
    .click();
  await dialog().locator("input[name=description]").fill("QA materials");
  await dialog().locator("input[name=amount]").fill("100.10");
  await dialog().locator("input[name=date]").fill("2026-11-03");
  await dialog()
    .getByRole("button", { name: "Add expense", exact: true })
    .click();
  await check("Expense added successfully");
  await page.getByRole("button", { name: "Edit QA materials" }).click();
  await dialog().locator("input[name=amount]").fill("16000.00");
  await dialog()
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await check("Cost overrun:");
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("civilhub:workspace:v1")),
  );
  assert.equal(state.jobs.find((j) => j.id === job.id).price, 1500000);
  assert.equal(
    state.expenses.find((e) => e.description === "QA materials").amount,
    1600000,
  );
  await page.getByRole("button", { name: "Delete QA materials" }).click();
  await dialog().getByRole("button", { name: "Delete", exact: true }).click();
  await check("Job balance updated");
  await page
    .locator(".sidebar nav")
    .getByRole("link", { name: "Overhead costs" })
    .click();
  async function overhead() {
    await page
      .getByRole("button", { name: "Add overhead", exact: true })
      .first()
      .click();
    await dialog().locator("select[name=companyId]").selectOption("shared");
    await dialog()
      .locator("input[name=description]")
      .fill("QA monthly broadband");
    await dialog().locator("select[name=category]").selectOption("Internet");
    await dialog().locator("input[name=amount]").fill("200.25");
    await dialog().locator("input[name=date]").fill("2026-11-03");
    await dialog().locator("input[type=checkbox]").check();
    await dialog()
      .getByRole("button", { name: "Add overhead", exact: true })
      .click();
  }
  await overhead();
  await check("Overhead added successfully");
  await overhead();
  await dialog().getByRole("alert").waitFor();
  assert.match(await dialog().getByRole("alert").innerText(), /already/);
  await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("link", { name: "Reports" })
    .click();
  await page.getByRole("heading", { name: "Financial reports." }).waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "outputs/reports.png", fullPage: true });
  const all = await page.locator(".stat-value").first().innerText();
  await page.getByLabel("Report company", { exact: true }).selectOption("akar");
  assert.notEqual(await page.locator(".stat-value").first().innerText(), all);
  await page.getByLabel("Report year", { exact: true }).selectOption("2026");
  await page.getByLabel("Report month", { exact: true }).selectOption("01");
  await check("No data for this period");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  assert.match((await csvPromise).suggestedFilename(), /report.csv/);
  await page.evaluate(
    () =>
      (window.print = () => {
        window.__printed = true;
      }),
  );
  await page.getByRole("button", { name: "Print report" }).click();
  assert.equal(await page.evaluate(() => window.__printed), true);
  await page.reload();
  await page.getByRole("heading", { name: "Financial reports." }).waitFor();
  assert.ok(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("civilhub:workspace:v1")).jobs.some(
        (j) => j.client === "QA Construction",
      ),
    ),
  );
  await page
    .getByRole("button", { name: "Search workspace", exact: true })
    .click();
  await dialog().getByLabel("Search workspace jobs").fill(job.number);
  await dialog()
    .getByRole("button", { name: new RegExp(job.number) })
    .click();
  await dialog()
    .getByRole("button", { name: "receipt.png", exact: true })
    .waitFor();
  await dialog().getByRole("button", { name: "Delete receipt.png" }).click();
  await dialog().getByRole("button", { name: "Delete", exact: true }).click();
  await check("Attachment deleted");
  await dialog()
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.goto(url);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page.screenshot({ path: "outputs/mobile.png", fullPage: true });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .locator(".sidebar nav")
    .getByRole("link", { name: "Dashboard" })
    .click();
  await page.getByRole("heading", { name: "Job dashboard." }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  assert.equal(
    await page.locator("input[name=password]").getAttribute("type"),
    "text",
  );
  await page.locator("input[name=password]").fill("wrong");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page.getByRole("alert").waitFor();
  await page.locator("input[name=password]").fill("civilhub123");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page.getByRole("heading", { name: /Choose a company/ }).waitFor();
  await page.screenshot({ path: "outputs/mobile-final.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: create job, custom client/work, map pin, attachments, preview/download/delete, expense edit/delete, overrun, recurring duplicates, chart filters, CSV/print, persistence, mobile navigation and demo login.",
  );
} finally {
  await browser.close();
}
