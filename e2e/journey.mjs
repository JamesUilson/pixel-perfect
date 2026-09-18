/**
 * The journey from the brief, driven through the real UI:
 *   REGISTER -> ADD CHEVROLET COBALT -> GARAGE -> PERSONALISED PRODUCTS
 *   -> SEARCH BRAKE PADS -> SEE COMPATIBILITY -> COMPARE SELLERS
 *   -> ADD TO CART -> CHECKOUT -> ORDER -> DELIVERY STATUS
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
// Set PLAYWRIGHT_CHROMIUM to reuse a preinstalled browser in CI.
const EXEC = process.env.PLAYWRIGHT_CHROMIUM;
const phone = "+9989" + String(Date.now()).slice(-8);
const pass = "Parol12345";

const steps = [];
const ok = (name, detail = "") => {
  steps.push(["PASS", name, detail]);
  console.log(`  ✓ ${name}${detail ? "  — " + detail : ""}`);
};
const bad = (name, detail = "") => {
  steps.push(["FAIL", name, detail]);
  console.log(`  ✗ ${name}  — ${detail}`);
};

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

try {
  // 1 — REGISTER
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.getByLabel("Ism familiya").fill("Baxtiyor Baxodirov");
  await page.getByLabel("Telefon raqami").fill(phone);
  await page.getByLabel("Parol").fill(pass);
  await page.getByRole("button", { name: "Ro'yxatdan o'tish" }).click();
  await page.waitForURL("**/garage/add", { timeout: 15000 });
  ok("REGISTER", phone);

  // 2 — ADD CHEVROLET COBALT
  await page.getByRole("button", { name: "Chevrolet", exact: true }).click();
  await page.getByRole("button", { name: "Cobalt", exact: true }).click();
  await page.getByRole("button", { name: "2023", exact: true }).click();
  await page.locator("button", { hasText: "Automatic" }).first().click();
  await page.getByLabel("Davlat raqami").fill("01 A 777 VA");
  await page.getByLabel("Yurgan masofa").fill("32480");
  await page.getByRole("button", { name: "Garajga qo'shish" }).click();
  await page.waitForURL("**/garage", { timeout: 15000 });
  ok("ADD CHEVROLET COBALT");

  // 3 — GARAGE shows the car
  await page.waitForSelector("text=Chevrolet Cobalt", { timeout: 10000 });
  const plate = await page.locator("text=01 A 777 VA").count();
  ok("OPEN GARAGE", plate ? "plate rendered" : "car rendered");

  // 4 — PERSONALISED PRODUCTS on the home page
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const heroHasCar = await page.locator("h1").first().innerText();
  const fitBadges = await page.locator("text=Mos keladi").count();
  if (fitBadges > 0)
    ok("PERSONALISED PRODUCTS", `${fitBadges} fitment badges, hero: "${heroHasCar.trim()}"`);
  else bad("PERSONALISED PRODUCTS", "no fitment badges rendered");

  // 5 — SEARCH FOR BRAKE PADS
  await page.getByRole("searchbox").first().fill("tormoz kolodka");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/marketplace**", { timeout: 15000 });
  await page.waitForTimeout(1200);
  const results = await page.locator("article").count();
  results > 0 ? ok("SEARCH FOR BRAKE PADS", `${results} results`) : bad("SEARCH", "no results");

  // 6 — PRODUCT + COMPATIBILITY + SELLER COMPARISON
  await page.locator("article a").first().click();
  await page.waitForURL("**/product/**", { timeout: 15000 });
  await page.waitForTimeout(1000);
  const compat = await page.locator("text=Mashinangizga mos keladi").count();
  const source = await page.locator("text=Rasmiy katalog bo'yicha").count();
  compat && source
    ? ok("SEE COMPATIBILITY", "status + source shown")
    : bad("SEE COMPATIBILITY", `compat=${compat} source=${source}`);

  const sellerRows = await page.locator("text=Sotuvchilarni solishtiring").count();
  sellerRows ? ok("COMPARE SELLERS") : bad("COMPARE SELLERS", "comparison block missing");

  // 7 — ADD TO CART
  await page.getByRole("button", { name: "Savatga qo'shish" }).first().click();
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const total = await page.locator("text=/so'm/").last().innerText();
  ok("ADD TO CART", `cart total ${total}`);

  // 8 — CHECKOUT
  await page.getByRole("link", { name: "Rasmiylashtirish" }).click();
  await page.waitForURL("**/checkout", { timeout: 15000 });
  await page.getByLabel("Ism familiya").fill("Baxtiyor Baxodirov");
  await page.getByLabel("Telefon", { exact: true }).fill(phone);
  await page.getByLabel("Tuman").fill("Chilonzor");
  await page.getByLabel("Ko'cha va uy").fill("Bunyodkor shoh ko'chasi 12");
  await page.getByRole("button", { name: "Buyurtmani tasdiqlash" }).click();
  await page.waitForURL("**/orders/**", { timeout: 20000 });
  await page.waitForTimeout(1200);
  const orderNo = await page.locator("h1").first().innerText();
  ok("CHECKOUT -> ORDER", orderNo.trim());

  // 9 — ORDER STATUS + HISTORY
  const status = await page.locator("text=Qabul qilindi").count();
  const history = await page.locator("text=Holatlar tarixi").count();
  status && history
    ? ok("DELIVERY STATUS", "status pill + event history")
    : bad("ORDER STATUS", `status=${status} history=${history}`);

  // 10 — ORDERS LIST
  await page.goto(`${BASE}/orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const rows = await page.locator("li a").count();
  rows > 0 ? ok("ORDER APPEARS IN LIST", `${rows} order(s)`) : bad("ORDERS LIST", "empty");

  // 11 — CART IS EMPTY AFTER CHECKOUT
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const empty = await page.locator("text=Savat bo'sh").count();
  empty ? ok("CART CLEARED") : bad("CART CLEARED", "cart still has items");
} catch (e) {
  bad("JOURNEY", String(e).split("\n")[0].slice(0, 200));
  await page.screenshot({ path: process.env.E2E_FAILURE_SHOT ?? "e2e-failure.png" });
}

console.log("\n  console/page errors:", errors.length ? errors.join(" | ") : "none");
const failed = steps.filter((s) => s[0] === "FAIL").length;
console.log(`\n  ${steps.length - failed}/${steps.length} steps passed`);
await browser.close();
process.exit(failed ? 1 : 0);
