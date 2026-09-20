/**
 * The two control panels, driven through the real UI against a seeded database.
 *
 *   SELLER: dashboard -> charts -> warehouses -> stock adjustment -> money
 *           -> orders -> Excel download
 *   ADMIN:  platform dashboard -> ledger integrity -> payout queue -> ads
 *
 * It asserts on what a person would look at: that the charts drew something,
 * that a stock adjustment actually changes a number, and that the workbook is
 * a workbook. A page that renders its own skeleton forever passes a smoke test
 * and fails this one.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const API = process.env.E2E_API_URL ?? "http://127.0.0.1:8000/api/v1";
const EXEC = process.env.PLAYWRIGHT_CHROMIUM;

const SELLER = ["+998901112233", "SellerDemo2026"];
const ADMIN = ["+998900000000", "ChangeMe2026!"];

const steps = [];
const ok = (name, detail = "") => {
  steps.push(["PASS", name, detail]);
  console.log(`  ✓ ${name}${detail ? "  — " + detail : ""}`);
};
const bad = (name, detail = "") => {
  steps.push(["FAIL", name, detail]);
  console.log(`  ✗ ${name}  — ${detail}`);
};

async function tokens([identifier, password]) {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!response.ok) throw new Error(`login ${identifier}: ${response.status}`);
  return (await response.json()).tokens;
}

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));

/** Sign in by planting the tokens the client already stores there. */
async function signIn(creds) {
  const pair = await tokens(creds);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([a, r]) => {
      localStorage.setItem("avtoqism.access", a);
      localStorage.setItem("avtoqism.refresh", r);
    },
    [pair.access_token, pair.refresh_token],
  );
}

/** Recharts draws into SVG; counting paths is how you tell a chart from a box. */
async function chartMarks(scope) {
  return page.locator(`${scope} svg.recharts-surface path`).count();
}

try {
  // ---- SELLER -------------------------------------------------------------
  await signIn(SELLER);

  await page.goto(`${BASE}/seller`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const storeName = (await page.locator("h1").first().innerText()).trim();
  storeName ? ok("SELLER DASHBOARD", storeName) : bad("SELLER DASHBOARD", "no store name");

  const money = await page.locator("text=/so'm/").count();
  money > 4 ? ok("KPI TILES", `${money} money figures`) : bad("KPI TILES", `only ${money}`);

  const marks = await chartMarks("body");
  marks > 10
    ? ok("CHARTS RENDERED", `${marks} svg marks`)
    : bad("CHARTS RENDERED", `${marks} marks — charts are blank`);

  // ---- WAREHOUSES ---------------------------------------------------------
  await page.goto(`${BASE}/seller/warehouses`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const branches = await page.locator("text=Asosiy ombor").count();
  branches ? ok("WAREHOUSES", "branch cards shown") : bad("WAREHOUSES", "no branches");

  const stockRows = await page.locator("table tbody tr").count();
  stockRows > 0 ? ok("STOCK TABLE", `${stockRows} rows`) : bad("STOCK TABLE", "empty");

  // A real adjustment: read the quantity, add to it, read it back. Column 3 of
  // the stock table is Qoldiq; the digits are grouped with spaces for display.
  const firstQty = async () => {
    const text = await page.locator("table tbody tr").first().locator("td").nth(2).innerText();
    return Number(text.replace(/\s/g, ""));
  };
  const before = await firstQty();
  await page
    .locator("table tbody tr")
    .first()
    .locator("button", { hasText: "Kirim/Chiqim" })
    .click();
  await page.locator("[role=dialog]").waitFor();
  await page.locator("[role=dialog] input[type=number]").fill("7");
  await page.locator("[role=dialog] button", { hasText: /^Saqlash/ }).click();
  await page.locator("[role=dialog]").waitFor({ state: "detached", timeout: 15000 });
  await page.waitForTimeout(1500);
  const after = await firstQty();
  after === before + 7
    ? ok("STOCK ADJUSTMENT", `${before} -> ${after}`)
    : bad("STOCK ADJUSTMENT", `${before} -> ${after}, expected ${before + 7}`);

  const movements = await page.locator("text=Harakatlar tarixi").count();
  movements ? ok("MOVEMENT HISTORY", "shown") : bad("MOVEMENT HISTORY", "missing");

  // ---- MONEY --------------------------------------------------------------
  await page.goto(`${BASE}/seller/finance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const ledgerRows = await page.locator("table tbody tr").count();
  ledgerRows > 0 ? ok("LEDGER", `${ledgerRows} entries`) : bad("LEDGER", "empty");

  const financeMarks = await chartMarks("body");
  financeMarks > 5
    ? ok("MONEY CHARTS", `${financeMarks} svg marks`)
    : bad("MONEY CHARTS", `${financeMarks} marks`);

  // ---- ORDERS -------------------------------------------------------------
  await page.goto(`${BASE}/seller/orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const orderRows = await page.locator("table tbody tr").count();
  orderRows > 0 ? ok("SELLER ORDERS", `${orderRows} rows`) : bad("SELLER ORDERS", "empty");

  // ---- EXCEL --------------------------------------------------------------
  const download = page.waitForEvent("download", { timeout: 20000 });
  await page
    .locator("button", { hasText: /Excelga/ })
    .first()
    .click();
  const file = await download;
  const name = file.suggestedFilename();
  name.endsWith(".xlsx") ? ok("EXCEL DOWNLOAD", name) : bad("EXCEL DOWNLOAD", `got ${name}`);

  // ---- ADMIN --------------------------------------------------------------
  await signIn(ADMIN);
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const gmv = await page.locator("text=/AYLANMA|GMV/i").count();
  gmv ? ok("ADMIN DASHBOARD", "GMV tile present") : bad("ADMIN DASHBOARD", "no GMV tile");

  const adminMarks = await chartMarks("body");
  adminMarks > 10
    ? ok("ADMIN CHARTS", `${adminMarks} svg marks`)
    : bad("ADMIN CHARTS", `${adminMarks} marks`);

  const sellersTable = await page.locator("text=Eng yaxshi sotuvchilar").count();
  sellersTable ? ok("TOP SELLERS") : bad("TOP SELLERS", "missing");

  await page.goto(`${BASE}/admin/finance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const balanced = await page.locator("text=muvozanatda").count();
  balanced
    ? ok("LEDGER INTEGRITY", "every entry group sums to zero")
    : bad("LEDGER INTEGRITY", "books do not balance, or the check did not render");

  await page.goto(`${BASE}/admin/ads`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const campaigns = await page.locator("table tbody tr").count();
  campaigns > 0 ? ok("ADMIN ADS", `${campaigns} campaigns`) : bad("ADMIN ADS", "none listed");

  const banners = await page.locator("text=/Banner|banner/").count();
  banners ? ok("HOUSE BANNERS", "section present") : bad("HOUSE BANNERS", "missing");
} catch (e) {
  bad("PANELS", String(e).split("\n")[0].slice(0, 220));
  await page.screenshot({ path: process.env.E2E_FAILURE_SHOT ?? "e2e-panels-failure.png" });
}

console.log("\n  console/page errors:", errors.length ? errors.join(" | ") : "none");
const failed = steps.filter((s) => s[0] === "FAIL").length;
console.log(`\n  ${steps.length - failed}/${steps.length} steps passed`);
await browser.close();
process.exit(failed ? 1 : 0);
