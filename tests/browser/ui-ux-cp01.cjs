// Focused CP01 browser QA. Uses the repository server and an externally installed
// Playwright/Chromium; adds no app dependencies. See v3-preview/README.md.
const { fork, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const out = process.env.CP01_OUTPUT || "/tmp/cp01-browser";
const server = fork(path.join(__dirname, "serve.cjs"), [], { silent: true });
const run = promisify(execFile);
(async () => {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
  });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    fs.mkdirSync(out, { recursive: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) =>
      errors.push({ url: page.url(), message: e.message }),
    );
    // Optional environment-only bridge: curl uses the managed proxy and trusted CA.
    // It forwards EXACT requested image URLs and bytes; no substitute art or URL mapping.
    const imageCache = new Map();
    if (process.env.CP01_IMAGE_PROXY === "1")
      await page.route(/^https:\/\//, async (route) => {
        if (route.request().resourceType() !== "image") return route.continue();
        const url = route.request().url();
        if (!imageCache.has(url))
          imageCache.set(
            url,
            run(
              "curl",
              [
                "--fail",
                "--location",
                "--silent",
                "--show-error",
                "--max-time",
                "25",
                url,
              ],
              { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 },
            )
              .then((r) => r.stdout)
              .catch((error) => {
                console.log(
                  "Image transport:",
                  String(error.stderr).slice(0, 180),
                );
                return null;
              }),
          );
        const body = await imageCache.get(url);
        if (body)
          await route.fulfill({
            status: 200,
            contentType: url.endsWith(".webp") ? "image/webp" : "image/png",
            body,
          });
        else await route.abort("failed");
      });
    const observations = [];
    async function metrics(label) {
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const m = await page.evaluate(() => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
        headerHeight: document
          .querySelector(".artwork-header")
          ?.getBoundingClientRect().height,
        firstRowTop: document
          .querySelector(".card-row")
          ?.getBoundingClientRect().top,
        art: document.querySelector(".artwork-header")?.dataset.art,
        navs: document.querySelectorAll(".bottom-nav").length,
      }));
      assert.equal(m.overflow, false, label + " horizontal overflow");
      observations.push({ label, ...m });
      await page.screenshot({ path: path.join(out, label + ".png") });
    }
    await page.goto("http://127.0.0.1:4173/v3-preview/", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(() => document.querySelector(".card-row"));
    await page.waitForFunction(
      () => document.querySelector(".artwork-header").dataset.art === "ready",
      null,
      { timeout: 30000 },
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".card-art")]
        .slice(0, 6)
        .every((node) => node.dataset.art === "ready"),
    );
    assert.equal(
      await page.evaluate(() => localStorage.length),
      0,
      "specimen must not write personal state",
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    assert.equal(
      await page
        .locator("main")
        .evaluate((node) => node === document.activeElement),
      true,
      "skip link focus",
    );
    assert.equal(
      await page
        .getByRole("heading", { name: "Preview route not found" })
        .count(),
      0,
    );
    await page.evaluate(() => scrollTo(0, 0));
    await metrics("390-portrait");
    await page.setViewportSize({ width: 360, height: 800 });
    await metrics("360-portrait");
    const first = page.getByRole("button", { name: /Inspect Raging Bolt ex/ });
    await first.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("dialog").count(), 1);
    await page.waitForFunction(
      () => document.querySelector("dialog .card-art")?.dataset.art === "ready",
    );
    await page.screenshot({ path: path.join(out, "card-inspector.png") });
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("dialog")
        .evaluate((node) => node.contains(document.activeElement)),
      true,
      "dialog traps focus",
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page
        .locator("dialog")
        .evaluate((node) => node.contains(document.activeElement)),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await first.evaluate((node) => node === document.activeElement),
      true,
    );
    await page.screenshot({ path: path.join(out, "keyboard-focus.png") });
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await page.screenshot({ path: path.join(out, "filter-sheet.png") });
    await page.getByLabel("Card group").selectOption("Trainers");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Filter: Trainers" })
        .evaluate((n) => n === document.activeElement),
      true,
    );
    await page.getByRole("button", { name: "Gallery", exact: true }).click();
    await page.evaluate(() => scrollTo(0, 500));
    await page.waitForTimeout(120);
    await page.getByRole("link", { name: "Meta", exact: true }).click();
    await page.reload();
    await page
      .getByRole("link", { name: "Return to specimen", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Gallery", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.waitForFunction(() => scrollY > 300);
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page
      .getByRole("link", { name: "Open Home in V2", exact: true })
      .click();
    await page.waitForURL("**/v2-preview/");
    await page.goBack();
    await page.waitForURL("**/#/home");
    await page.goBack();
    await page.waitForURL("**/#/specimen");
    assert.equal(
      await page
        .getByRole("button", { name: "Gallery", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.goForward();
    await page.waitForURL("**/#/home");
    assert.ok((await page.url()).endsWith("#/home"));
    await page.goBack();
    await page.waitForURL("**/#/specimen");
    await page.getByRole("button", { name: "Filter: Trainers" }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    await metrics("360-gallery");
    await page.getByRole("button", { name: "List", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await metrics("desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addStyleTag({ content: ":root{font-size:200%}" });
    await metrics("390-text-200");
    await page.reload();
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--motion")
          .trim(),
      ),
      "0ms",
    );
    await page.goto("http://127.0.0.1:4173/v3-preview/#/specimen/states");
    assert.equal(
      await page.locator("#expanded-example").getAttribute("open"),
      "",
    );
    assert.equal(
      await page.locator("#collapsed-example").getAttribute("open"),
      null,
    );
    await page.locator(".art-fallback").scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".deck-sprite-img")].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await metrics("390-states");
    await page.screenshot({
      path: path.join(out, "states-full.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Retry sample", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("heading", { name: "Sample retry complete" })
        .count(),
      1,
    );
    const missing = page.getByRole("button", {
      name: /Inspect A deliberately long/,
    });
    await missing.click();
    await metrics("missing-art-dialog");
    await page.keyboard.press("Escape");
    assert.equal(
      await missing.evaluate((n) => n === document.activeElement),
      true,
    );
    await page.goto("http://127.0.0.1:4173/v3-preview/#/invalid");
    assert.equal(
      await page
        .getByRole("heading", { name: "Preview route not found" })
        .count(),
      1,
    );
    await page.getByRole("link", { name: "Open component specimen" }).click();
    // Simulated CSS safe-area inset, not a claim of physical iPhone testing.
    await page.addStyleTag({ content: ":root{--safe-bottom:34px}" });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await metrics("safe-area-bottom");
    assert.ok(
      await page.evaluate(
        () =>
          document.querySelector("main > a:last-child").getBoundingClientRect()
            .bottom <=
          document.querySelector(".bottom-nav").getBoundingClientRect().top,
      ),
    );
    assert.deepEqual(
      errors.filter((error) => error.url.includes("/v3-preview/")),
      [],
      "no new V3 runtime failures",
    );
    // V2's own external/runtime failures are separately scoped from V3 page errors.
    fs.writeFileSync(
      path.join(out, "observations.json"),
      JSON.stringify({ observations, pageErrors: errors }, null, 2),
    );
    console.log(JSON.stringify({ observations, pageErrors: errors }));
  } finally {
    await browser.close();
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => server.kill());
