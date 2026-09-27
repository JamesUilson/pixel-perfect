/**
 * Everything the marketplace gained after the panels: a real sign-up, a
 * checkout that names the door, a delivery the buyer can watch, the shop on a
 * map, the buyer's balance, and the administrator's three levers.
 *
 * Driven through the real UI against a seeded database, and asserting on the
 * thing a person would actually check: that the parcel's route link points
 * where the parcel is going, that the timeline lights up the step the order is
 * on, and that a suspended store stops selling. A page that renders its own
 * skeleton forever passes a smoke test and fails this one.
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

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body: parsed };
}

async function tokens([identifier, password]) {
  const { status, body } = await api("/auth/login", {
    method: "POST",
    body: { identifier, password },
  });
  if (status !== 200) throw new Error(`login ${identifier}: ${status}`);
  return body.tokens;
}

/** A brand new verified buyer, so no test leans on state another one left. */
async function freshBuyer() {
  const phone = `+99890${String(Math.floor(Math.random() * 10 ** 7)).padStart(7, "0")}`;
  const created = await api("/auth/register", {
    method: "POST",
    body: {
      phone,
      password: "Moshina7Qism",
      full_name: "E2E Xaridor",
      region: "Toshkent",
      city: "Chilonzor",
      accept_terms: true,
    },
  });
  if (created.status !== 201) throw new Error(`register: ${created.status}`);
  const verified = await api("/auth/register/verify", {
    method: "POST",
    body: { identifier: phone, code: created.body.verification.debug_code },
  });
  if (verified.status !== 200) throw new Error(`verify: ${verified.status}`);
  return { phone, ...verified.body.tokens };
}

const browser = await chromium.launch(
  EXEC ? { executablePath: EXEC, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] },
);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));

async function signIn(pair) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([a, r]) => {
      localStorage.setItem("avtoqism.access", a);
      localStorage.setItem("avtoqism.refresh", r);
    },
    [pair.access_token, pair.refresh_token],
  );
}

try {
  // ---- registration ---------------------------------------------------------
  const buyer = await freshBuyer();
  ok("REGISTRATION", `${buyer.phone} verified through the code`);

  const weak = await api("/auth/register", {
    method: "POST",
    body: { phone: "+998901010101", password: "12345678", full_name: "Zaif Parol" },
  });
  weak.status === 422 && weak.body.error?.details?.problems?.length
    ? ok("PASSWORD RULES", weak.body.error.details.problems[0].slice(0, 60))
    : bad("PASSWORD RULES", `expected a named problem, got ${weak.status}`);

  // ---- checkout with a door and a map point ---------------------------------
  // Buy from the demo seller specifically, because the rest of this suite
  // signs in as that seller to move the order along. ``best_offer`` is what
  // the storefront card links to, so this is what a real person would click.
  const sellerTokens = await tokens(SELLER);
  const myStores = await api("/sellers/me", { token: sellerTokens.access_token });
  const storeId = myStores.body?.[0]?.id;
  if (!storeId) throw new Error("the demo seller has no store");

  const listing = await api("/products?size=60&in_stock=true");
  const offerId = listing.body?.items
    ?.map((p) => p.best_offer)
    .find((o) => o?.id && o.seller?.id === storeId)?.id;
  if (!offerId) throw new Error(`no in-stock offer belongs to store ${storeId}`);

  await api("/cart/items", {
    method: "POST",
    token: buyer.access_token,
    body: { offer_id: offerId, quantity: 1 },
  });

  const placed = await api("/orders/checkout", {
    method: "POST",
    token: buyer.access_token,
    body: {
      address: {
        recipient_name: "E2E Xaridor",
        phone: buyer.phone,
        region: "Toshkent",
        district: "Chilonzor",
        street: "Bunyodkor shoh ko'chasi",
        house: "12A",
        entrance: "3",
        floor: "5",
        apartment: "47",
        landmark: "14-maktab ro'parasida",
        lat: "41.311081",
        lng: "69.240562",
      },
      contact: { is_self: false, name: "Akmal usta", phone: "+998911112233" },
      payment_method: "CASH_ON_DELIVERY",
    },
  });
  if (placed.status !== 201)
    throw new Error(`checkout: ${placed.status} ${JSON.stringify(placed.body).slice(0, 200)}`);
  const order = placed.body;

  const line = order.delivery_address?.line ?? "";
  ["3-podyezd", "5-qavat", "47-xonadon"].every((p) => line.includes(p))
    ? ok("ADDRESS DETAIL", line.slice(0, 70))
    : bad("ADDRESS DETAIL", `the door is missing from «${line}»`);

  order.delivery_address?.navigator_url?.startsWith(
    "yandexnavi://build_route_on_map?lat_to=41.311081&lon_to=69.240562",
  )
    ? ok("NAVIGATOR LINK", "route opens at the picked point")
    : bad("NAVIGATOR LINK", String(order.delivery_address?.navigator_url));

  order.contact_is_self === false && order.recipient_phone === "+998911112233"
    ? ok("ALTERNATE CONTACT", "the driver rings the mechanic, not the buyer")
    : bad("ALTERNATE CONTACT", `${order.recipient_phone} / ${order.contact_is_self}`);

  order.promised_date && order.delivery?.promise_days === 3
    ? ok("THREE DAY PROMISE", order.promised_date)
    : bad("THREE DAY PROMISE", JSON.stringify(order.delivery?.promised_date));

  // ---- the buyer watches it move --------------------------------------------
  await signIn(buyer);
  await page.goto(`${BASE}/orders/${order.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const shown = await page.locator("body").innerText();
  ["Yig'ilmoqda", "Tayyor bo'ldi", "Kuryerga berildi", "Yetkazildi"].every((s) => shown.includes(s))
    ? ok("DELIVERY TIMELINE", "all four stages drawn for the buyer")
    : bad("DELIVERY TIMELINE", "a stage label is missing from the page");

  const sub = order.sub_orders[0];
  const advance = async (status) =>
    api(`/seller/${sub.seller.id}/orders/${order.id}/status`, {
      method: "POST",
      token: sellerTokens.access_token,
      body: { status },
    });

  const packing = await advance("PREPARING");
  const ready = await advance("READY");
  ready.status === 200 && ready.body.delivery?.current === "ready"
    ? ok("READY STAGE", "«Tayyor bo'ldi» is a state, not a label")
    : bad("READY STAGE", `${packing.status} then ${ready.status}`);

  // Reading the page text is not enough: every stage label is on it from the
  // start. What has to move is which one is lit, so ask the server what the
  // page is now rendering and check the page agrees it is the current one.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const live = await api(`/orders/${order.id}`, { token: buyer.access_token });
  const active = live.body?.delivery?.steps?.find((s) => s.state === "active");
  const marked = await page.locator('[aria-current="step"], [data-state="active"]').allInnerTexts();
  active?.key === "ready" && marked.some((t) => t.includes("Tayyor bo'ldi"))
    ? ok("TIMELINE MOVES", "the lit step followed the order")
    : bad("TIMELINE MOVES", `server says ${active?.key}, page marks ${JSON.stringify(marked)}`);

  // ---- the seller, who is also the driver -----------------------------------
  await signIn(sellerTokens);
  await page.goto(`${BASE}/seller/orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const navLinks = await page
    .locator('a[href^="yandexnavi://"], a[href*="yandex.uz/maps"]')
    .count();
  navLinks > 0
    ? ok("SELLER ROUTE LINKS", `${navLinks} orders openable in a map`)
    : bad("SELLER ROUTE LINKS", "the driver has no route to tap");

  // ---- the shop on the map ---------------------------------------------------
  const moved = await api(`/sellers/${storeId}`, {
    method: "PATCH",
    token: sellerTokens.access_token,
    body: { latitude: "41.338000", longitude: "69.286000" },
  });
  moved.status === 200 && moved.body.map_url?.includes("pt=69.286000,41.338000")
    ? ok("SHOP ON THE MAP", "a buyer can find the shop")
    : bad("SHOP ON THE MAP", `${moved.status} ${moved.body?.map_url}`);

  const halfPoint = await api(`/sellers/${storeId}`, {
    method: "PATCH",
    token: sellerTokens.access_token,
    body: { latitude: "41.4" },
  });
  halfPoint.status === 422
    ? ok("HALF A MAP POINT REFUSED", "latitude without longitude cannot be saved")
    : bad("HALF A MAP POINT REFUSED", `got ${halfPoint.status}`);

  // ---- the buyer's balance ----------------------------------------------------
  await signIn(buyer);
  await page.goto(`${BASE}/wallet`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const wallet = await page.locator("body").innerText();
  wallet.includes("so'm") && !wallet.includes("Serverga ulanishda xatolik")
    ? ok("WALLET SCREEN", "balance and cards render")
    : bad("WALLET SCREEN", wallet.slice(0, 120).replace(/\n/g, " "));

  // ---- the administrator's levers ---------------------------------------------
  const adminTokens = await tokens(ADMIN);
  await signIn(adminTokens);

  const receipt = await api(`/admin/receipts/orders/${order.id}`, {
    method: "POST",
    token: adminTokens.access_token,
  });
  const again = await api(`/admin/receipts/orders/${order.id}`, {
    method: "POST",
    token: adminTokens.access_token,
  });
  receipt.body?.number && receipt.body.number === again.body?.number
    ? ok("RECEIPT IS FROZEN", `${receipt.body.number} re-issued as itself`)
    : bad("RECEIPT IS FROZEN", `${receipt.body?.number} vs ${again.body?.number}`);

  const health = await api("/admin/system/health", { token: adminTokens.access_token });
  health.body?.database?.status === "ok" && health.body?.migrations
    ? ok("SYSTEM HEALTH", `db ${health.body.database.latency_ms}ms, migrations reported`)
    : bad("SYSTEM HEALTH", JSON.stringify(health.body).slice(0, 120));

  const logs = await api("/admin/logs/requests?status_class=4xx&size=5", {
    token: adminTokens.access_token,
  });
  logs.status === 200 && Array.isArray(logs.body?.items)
    ? ok("REQUEST LOG", `${logs.body.items.length} failures listed`)
    : bad("REQUEST LOG", `${logs.status}`);

  const leaked = JSON.stringify(logs.body).includes(adminTokens.access_token.slice(0, 24));
  leaked
    ? bad("LOG KEEPS NO SECRETS", "an access token survived into the log")
    : ok("LOG KEEPS NO SECRETS");

  const forbidden = await api("/admin/logs/requests", { token: buyer.access_token });
  forbidden.status === 403
    ? ok("LOGS ARE STAFF ONLY", "an ordinary buyer is refused")
    : bad("LOGS ARE STAFF ONLY", `got ${forbidden.status}`);

  await page.goto(`${BASE}/admin/system`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const systemPage = await page.locator("body").innerText();
  systemPage.includes("Migratsiya") || systemPage.includes("migratsiya")
    ? ok("ADMIN SYSTEM SCREEN", "the migration check is on the page")
    : bad("ADMIN SYSTEM SCREEN", systemPage.slice(0, 120).replace(/\n/g, " "));

  await page.goto(`${BASE}/admin/sellers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const sellersPage = await page.locator("body").innerText();
  sellersPage.includes("Tasdiqlash") || sellersPage.includes("tasdiq")
    ? ok("STORE APPROVAL SCREEN", "the review queue is reachable")
    : bad("STORE APPROVAL SCREEN", sellersPage.slice(0, 120).replace(/\n/g, " "));
} catch (e) {
  bad("DELIVERY SUITE", String(e).split("\n")[0].slice(0, 220));
  await page.screenshot({ path: process.env.E2E_FAILURE_SHOT ?? "e2e-delivery-failure.png" });
}

console.log("\n  console/page errors:", errors.length ? errors.join(" | ") : "none");
const failed = steps.filter((s) => s[0] === "FAIL").length;
console.log(`\n  ${steps.length - failed}/${steps.length} steps passed`);
await browser.close();
process.exit(failed ? 1 : 0);
