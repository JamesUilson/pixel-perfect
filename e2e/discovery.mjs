/**
 * The home band, stores near you, and the account's own lists.
 *
 * What is worth a step each: that the page has one rotating band and not a
 * band plus a second full-bleed hero stacked under it, that the hero slide
 * never reports an ad impression, that "nearby" means a measured distance and
 * not a rating in disguise, and that declining the location prompt still
 * leaves a useful list.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const API = process.env.E2E_API_URL ?? "http://127.0.0.1:8000/api/v1";
const EXEC = process.env.PLAYWRIGHT_CHROMIUM;

const BUYER = ["+998901234567", "Demo12345"];
//: Central Tashkent, the point the seeded stores are placed around.
const HERE = { latitude: 41.311081, longitude: 69.240562 };

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

const browser = await chromium.launch(
  EXEC ? { executablePath: EXEC, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] },
);
const errors = [];

/** A context that answers the geolocation prompt however the test needs. */
async function contextAt(point) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(point ? { geolocation: point, permissions: ["geolocation"] } : {}),
  });
  return ctx;
}

try {
  const buyer = await tokens(BUYER);

  // ---- one band, not two ----------------------------------------------------
  const plain = await contextAt(null);
  const page = await plain.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  overflow === 0
    ? ok("NO HORIZONTAL OVERFLOW", "at 1440px")
    : bad("NO HORIZONTAL OVERFLOW", `${overflow}px`);

  //: The hero used to be a section of its own below the carousel. It is now a
  //: slide inside it, so it must appear exactly once and the page must not
  //: carry two stacked full-bleed blocks.
  const heroCount = await page.getByText("Mashinangiz uchun aniq tanlov").count();
  heroCount === 1
    ? ok("HERO IS ONE SLIDE", "not a second stacked section")
    : bad("HERO IS ONE SLIDE", `found ${heroCount}`);

  //: The hero is slide 0 and must never wear the chip. A paid slide must, so
  //: the test advances to one rather than accepting whatever is on screen.
  //: Every slide stays mounted, so a plain count finds the chip on a slide
  //: nobody can see. Only the visible panel counts — off-screen ones are
  //: aria-hidden, which is exactly the distinction to assert on.
  const visibleChip = () =>
    page
      .locator('[aria-roledescription="karusel"] [aria-hidden="false"]')
      .getByText(/^Reklama$/i)
      .count();
  const heroChip = await visibleChip();
  const slot = await api("/ads/slots/HOME_SLIDER?limit=6");
  const sponsored = (slot.body ?? []).filter((s) => s.sponsored).length;
  const nextDot = page.locator('button[aria-label*="slayd"], [role="tablist"] button').nth(1);
  if ((await nextDot.count()) > 0) await nextDot.click();
  await page.waitForTimeout(900);
  const afterChip = await visibleChip();
  heroChip === 0 && (sponsored === 0 || afterChip > 0)
    ? ok("ONLY PAID SLIDES ARE LABELLED", `hero clean, ${sponsored} sponsored in the slot`)
    : bad(
        "ONLY PAID SLIDES ARE LABELLED",
        `hero=${heroChip} after=${afterChip} sponsored=${sponsored}`,
      );

  // ---- the location prompt, both answers ------------------------------------
  const before = await page.locator("body").innerText();
  before.includes("Yaqinimdagilarni ko'rsatish")
    ? ok("LOCATION IS ASKED FOR, NOT TAKEN", "a control, not an on-load prompt")
    : bad("LOCATION IS ASKED FOR, NOT TAKEN", "no opt-in control on the page");

  //: Declining must leave the section useful, not empty.
  const rated = await api("/sellers/nearby");
  rated.body?.basis === "rating" && rated.body.items.length > 0
    ? ok("DECLINED STILL LISTS STORES", `${rated.body.items.length} by rating`)
    : bad("DECLINED STILL LISTS STORES", JSON.stringify(rated.body).slice(0, 90));
  await plain.close();

  // ---- granted: real distances, really ordered -------------------------------
  const located = await contextAt(HERE);
  const near = await located.newPage();
  near.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
  await near.goto(BASE, { waitUntil: "networkidle" });
  await near.waitForTimeout(1500);
  const askButton = near.getByRole("button", { name: /Yaqinimdagilarni ko'rsatish/ }).first();
  if ((await askButton.count()) > 0) {
    await askButton.click();
    await near.waitForTimeout(2500);
    //: Looking at the whole page would match the section's own "10 km
    //: radiusda" caption and pass whether or not a single store carries a
    //: distance. The figure has to be on a store, beside its name.
    const cards = await near
      .locator("section:has-text('do\\'konlar') a, section:has-text('do\\'konlar') article")
      .allInnerTexts();
    const withDistance = cards.filter((c) => /\d+[.,]?\d*\s*(km|m)\b/.test(c));
    withDistance.length > 0
      ? ok(
          "DISTANCES ARE ON THE STORES",
          `${withDistance.length} of ${cards.length} cards: ${withDistance[0].replace(/\n/g, " ").slice(0, 44)}`,
        )
      : bad("DISTANCES ARE ON THE STORES", `${cards.length} cards, none carry a figure`);
  } else {
    bad("DISTANCES ARE ON THE STORES", "the opt-in control was not found");
  }
  await located.close();

  const measured = await api(
    `/sellers/nearby?lat=${HERE.latitude}&lng=${HERE.longitude}&radius_km=15`,
  );
  const km = measured.body?.items?.map((i) => Number(i.distance_km)) ?? [];
  measured.body?.basis === "distance" &&
  km.length > 1 &&
  km.every((d, i) => i === 0 || d >= km[i - 1])
    ? ok("NEAREST FIRST", km.map((d) => `${d}km`).join(" < "))
    : bad("NEAREST FIRST", JSON.stringify(km));

  measured.body?.items?.every((i) => i.pin_url && i.navigator_url)
    ? ok("MAP LINKS COME FROM THE SERVER", "pin and route on every row")
    : bad("MAP LINKS COME FROM THE SERVER", "a row is missing a link");

  const outside = await api(
    `/sellers/nearby?lat=${HERE.latitude}&lng=${HERE.longitude}&radius_km=3`,
  );
  outside.body?.items?.length < measured.body?.items?.length
    ? ok("RADIUS EXCLUDES", `${outside.body.items.length} within 3km vs ${km.length} within 15km`)
    : bad("RADIUS EXCLUDES", "the radius changed nothing");

  const half = await api(`/sellers/nearby?lat=${HERE.latitude}`);
  half.status === 422
    ? ok("HALF A POINT REFUSED", "")
    : bad("HALF A POINT REFUSED", `got ${half.status}`);

  const mapped = await api(`/sellers/map?lat=${HERE.latitude}&lng=${HERE.longitude}`);
  mapped.status === 200 && mapped.body?.pins?.length > 0 && mapped.body?.center?.latitude
    ? ok("MAP PAYLOAD", `${mapped.body.pins.length} pins around a centre`)
    : bad("MAP PAYLOAD", JSON.stringify(mapped.body).slice(0, 90));

  // ---- the account's own lists ------------------------------------------------
  const ctx = await contextAt(null);
  const mine = await ctx.newPage();
  mine.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
  await mine.goto(BASE, { waitUntil: "domcontentloaded" });
  await mine.evaluate(
    ([a, r]) => {
      localStorage.setItem("avtoqism.access", a);
      localStorage.setItem("avtoqism.refresh", r);
    },
    [buyer.access_token, buyer.refresh_token],
  );

  //: Follow a store and save a clip through the API, then look for both on the
  //: profile — the point of the sections is that they reflect what was done.
  const feed = await api("/feed?limit=1");
  const item = feed.body?.items?.[0];
  if (!item) throw new Error("the feed is empty — run scripts.seed_feed");
  await api("/feed/follow", {
    method: "POST",
    token: buyer.access_token,
    body: { seller_id: item.seller.id },
  });
  await api(`/videos/${item.video.id}/save`, { method: "POST", token: buyer.access_token });

  const following = await api("/me/following", { token: buyer.access_token });
  const saved = await api("/me/saved-videos", { token: buyer.access_token });
  following.body?.items?.length > 0 && saved.body?.items?.length > 0
    ? ok(
        "FOLLOWING AND SAVES ARE READABLE",
        `${following.body.total} channels, ${saved.body.total} clips`,
      )
    : bad("FOLLOWING AND SAVES ARE READABLE", `${following.status} / ${saved.status}`);

  await mine.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await mine.waitForTimeout(2500);
  const profile = await mine.locator("body").innerText();
  const wanted = ["Obuna bo'lgan", "Saqlangan"];
  wanted.every((w) => profile.includes(w))
    ? ok("PROFILE SHOWS BOTH SECTIONS", wanted.join(" / "))
    : bad("PROFILE SHOWS BOTH SECTIONS", profile.slice(0, 140).replace(/\n/g, " "));

  profile.includes(item.seller.store_name)
    ? ok("THE FOLLOWED STORE IS LISTED", item.seller.store_name)
    : bad("THE FOLLOWED STORE IS LISTED", "the store just followed is absent");

  //: One person's lists are their own.
  const stranger = await api("/me/following");
  stranger.status === 401
    ? ok("LISTS ARE PRIVATE", "unauthenticated is refused")
    : bad("LISTS ARE PRIVATE", `got ${stranger.status}`);

  // ---- the seller's own front door ---------------------------------------------
  await mine.goto(`${BASE}/register/seller`, { waitUntil: "networkidle" });
  await mine.waitForTimeout(1800);
  const sellerPath = await mine.locator("body").innerText();
  sellerPath.length > 200 && /tasdiq|ko'rik|admin/i.test(sellerPath)
    ? ok("SELLER SIGN-UP EXISTS", "and states the approval step up front")
    : bad("SELLER SIGN-UP EXISTS", sellerPath.slice(0, 140).replace(/\n/g, " "));

  await mine.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await mine.waitForTimeout(1200);
  const fromLogin = await mine.getByRole("link", { name: /sotuvchi/i }).count();
  fromLogin > 0
    ? ok("SELLER DOOR IS UNDER THE SIGN-IN FORM", `${fromLogin} link(s)`)
    : bad("SELLER DOOR IS UNDER THE SIGN-IN FORM", "not linked from /login");
  await ctx.close();
} catch (e) {
  bad("DISCOVERY SUITE", String(e).split("\n")[0].slice(0, 220));
}

console.log("\n  console/page errors:", errors.length ? errors.join(" | ") : "none");
const failed = steps.filter((s) => s[0] === "FAIL").length;
console.log(`\n  ${steps.length - failed}/${steps.length} steps passed`);
await browser.close();
process.exit(failed ? 1 : 0);
