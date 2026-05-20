import fs from "fs";
import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.WORKFUSION_E2E_URL || "https://www.workfusionapp.com";
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

test.use({
  baseURL: baseUrl,
  viewport: { width: 1440, height: 1300 },
  launchOptions: fs.existsSync(chromePath) ? { executablePath: chromePath } : undefined,
});

test.describe.configure({ mode: "serial" });

function uniqueEmail(prefix: string) {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2)}@workfusionapp.test`;
}

async function expectNoBrowserErrors(page: Page, action: () => Promise<void>) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await action();
  expect(errors, errors.join("\n")).toEqual([]);
}

async function waitForIdle(page: Page) {
  await expect(page.getByText("Ready").first()).toBeVisible({ timeout: 120_000 });
}

async function openConsole(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Generate a free EA draft" }).click();
  await expect(page.getByText("Operator console")).toBeVisible();
}

test("homepage explains the product and captures opt-in intent", async ({ page }) => {
  await expectNoBrowserErrors(page, async () => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByText("AI EA Generator + Debugger for MT4/MT5 traders")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Generate, debug,/ })).toBeVisible();
    await expect(page.getByText("Paste compiler errors / Generate EA draft / Get risk check").first()).toBeVisible();
    await page.locator('input[placeholder="developer@example.com"]').first().fill(uniqueEmail("homepage"));
    await page.locator('label:has-text("I agree to receive Workfusion EA builder updates") input').first().check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/update list|Opt-in saved|Saved/i).first()).toBeVisible({ timeout: 30_000 });
  });
});

test("generate, compile, backtest, and download stay understandable from the frontend", async ({ page }) => {
  await expectNoBrowserErrors(page, async () => {
    await openConsole(page);

    await page.getByRole("button", { name: "Generate EA" }).click();
    await waitForIdle(page);
    await expect.poll(async () => (await page.locator("pre").first().innerText()).length, { timeout: 120_000 }).toBeGreaterThan(5_000);
    await expect(page.locator("pre").first()).toContainText("#property strict");
    await expect(page.getByText("Want a free workflow review or help with the next compiler error?")).toBeVisible();

    const generatedDraft = await page.locator("pre").first().innerText();
    await page.getByRole("button", { name: "Compile check" }).click();
    await waitForIdle(page);
    await expect(page.getByText("Checked input: this action reviewed the EA draft shown here")).toBeVisible();
    await expect(page.getByText(/Compiler/i).first()).toBeVisible();
    await expect(page.locator("pre").first()).toContainText(generatedDraft.slice(0, 80));

    await page.getByRole("button", { name: "Backtest estimate" }).click();
    await waitForIdle(page);
    await expect(page.getByText("This is an estimator, not a real MT5 Strategy Tester result.")).toBeVisible();
    await expect(page.locator("pre").first()).toContainText(generatedDraft.slice(0, 80));

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download EA" }).click();
    const download = await downloadPromise;
    await waitForIdle(page);
    expect(download.suggestedFilename()).toMatch(/workfusion-ea\.mq5$/u);
    await expect(page.getByText(/Download ready: workfusion-ea\.mq5/i)).toBeVisible();
  });
});

test("real MQL5 issue templates produce visible fixes and tutorial links", async ({ page }) => {
  await expectNoBrowserErrors(page, async () => {
    await openConsole(page);
    await page.getByRole("button", { name: /Invalid volume 10014/ }).click();
    await page.getByRole("button", { name: "Fix code" }).click();
    await waitForIdle(page);
    await expect(page.getByText(/Invalid volume/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /fix mql5 invalid volume lot step/i })).toBeVisible();

    const fixedCode = await page.locator("pre").first().innerText();
    expect(fixedCode).toContain("NormalizeVolume");
    expect(fixedCode).toContain("SYMBOL_VOLUME_STEP");
  });
});

test("compile check and backtest estimate do not erase the current draft", async ({ page }) => {
  await expectNoBrowserErrors(page, async () => {
    await openConsole(page);
    await page.getByRole("button", { name: /CopyBuffer array range/ }).click();
    await page.getByRole("button", { name: "Compile check" }).click();
    await waitForIdle(page);
    await expect(page.getByText("Checked input: this action reviewed the EA draft shown here")).toBeVisible();
    await expect(page.getByText(/Array out-of-range risk detected/i)).toBeVisible();
    await expect(page.locator("pre").first()).toContainText("CopyBuffer");

    await page.getByRole("button", { name: "Backtest estimate" }).click();
    await waitForIdle(page);
    await expect(page.getByText("This is an estimator, not a real MT5 Strategy Tester result.")).toBeVisible();
    await expect(page.locator("pre").first()).toContainText("CopyBuffer");
  });
});

test("support desk creates a visible ticket for a frontend user", async ({ page }) => {
  await expectNoBrowserErrors(page, async () => {
    await page.goto("/#support", { waitUntil: "networkidle" });
    await expect(page.getByText("Support desk")).toBeVisible();
    await page.locator('input[placeholder="email for reply"]').fill(uniqueEmail("support"));
    await page.locator('select').filter({ hasText: "Bug" }).selectOption("compiler_error");
    await page.locator('input[placeholder="short subject"]').fill("Compiler fixer visible-answer test");
    await page.locator('textarea[placeholder^="Describe what happened"]').fill(
      "I pasted a CopyBuffer EA issue and need to know whether the output tells me the exact fix and tutorial link.",
    );
    await page.getByRole("button", { name: "Send to support" }).click();
    await expect(page.getByText(/Ticket .* created\. Priority:/i)).toBeVisible({ timeout: 60_000 });
  });
});

test("high-intent resource pages show one fix path and one opt-in path", async ({ page }) => {
  await expectNoBrowserErrors(page, async () => {
    for (const path of [
      "/resources/fix-mql5-invalid-volume-lot-step",
      "/resources/fix-mql5-unsupported-filling-mode",
      "/resources/fix-mql5-array-out-of-range-copybuffer",
      "/resources/avoid-overfitting-mt5-ea-backtests",
    ]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expect(page.getByText("Implementation checklist")).toBeVisible();
      await expect(page.getByText("Paste compiler errors / Generate EA draft / Get risk check")).toBeVisible();
      await expect(page.locator('input[placeholder="developer@example.com"]')).toBeVisible();
    }
  });
});
