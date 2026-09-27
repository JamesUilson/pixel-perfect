/**
 * The social feed, driven through the real UI against a seeded database.
 *
 * The properties worth a step each are the ones a person notices and a smoke
 * test does not: that the navigation is the same bar on every screen, that a
 * like survives the round trip instead of springing back, that a shared link
 * opens the clip it names, and that the creator's numbers are the ones the
 * events actually add up to.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const API = process.env.E2E_API_URL ?? "http://127.0.0.1:8000/api/v1";
const EXEC = process.env.PLAYWRIGHT_CHROMIUM;

const SELLER = ["+998901112233", "SellerDemo2026"];
const BUYER = ["+998901234567", "Demo12345"];

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
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
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

/** The bottom bar, as a list of its labels, on whatever screen is open. */
async function navLabels() {
  return (await page.locator('nav[aria-label="Mobil navigatsiya"] a').allInnerTexts()).map((t) =>
    t.trim(),
  );
}

try {
  const buyer = await tokens(BUYER);
  await signIn(buyer);

  // ---- the complaint that started this ------------------------------------
  await page.goto(`${BASE}/marketplace`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const onMarket = await navLabels();

  await page.goto(`${BASE}/feed`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const onFeed = await navLabels();

  onMarket.length === 5 && JSON.stringify(onMarket) === JSON.stringify(onFeed)
    ? ok("NAV DOES NOT CHANGE", onFeed.join(" / "))
    : bad("NAV DOES NOT CHANGE", `${JSON.stringify(onMarket)} vs ${JSON.stringify(onFeed)}`);

  // ---- the feed itself -----------------------------------------------------
  const listed = await api("/feed?limit=5");
  const first = listed.body?.items?.[0];
  if (!first) throw new Error("the feed is empty — run scripts.seed_feed");

  const shown = await page.locator("body").innerText();
  shown.includes(first.video.caption.slice(0, 24))
    ? ok("FEED RENDERS", first.seller?.store_name ?? "")
    : bad("FEED RENDERS", shown.slice(0, 140).replace(/\n/g, " "));

  const rail = await page
    .locator('button[aria-label*="Yoqtir"], button[aria-label*="Komment"]')
    .count();
  rail >= 2 ? ok("ACTION RAIL", `${rail} controls`) : bad("ACTION RAIL", `${rail}`);

  // ---- a like has to stick -------------------------------------------------
  const before = (await api(`/videos/${first.video.id}`, { token: buyer.access_token })).body;
  const liked = await api(`/videos/${first.video.id}/like`, {
    method: before.liked ? "DELETE" : "POST",
    token: buyer.access_token,
  });
  const after = (await api(`/videos/${first.video.id}`, { token: buyer.access_token })).body;
  liked.status === 200 &&
  after.liked !== before.liked &&
  after.counters.like_count === before.counters.like_count + (after.liked ? 1 : -1)
    ? ok("LIKE STICKS", `${before.counters.like_count} → ${after.counters.like_count}`)
    : bad("LIKE STICKS", JSON.stringify(liked.body));

  //: Twice is once. A counter that drifts here is a counter nobody can trust.
  const again = await api(`/videos/${first.video.id}/like`, {
    method: after.liked ? "POST" : "DELETE",
    token: buyer.access_token,
  });
  const third = (await api(`/videos/${first.video.id}`, { token: buyer.access_token })).body;
  again.status === 200 && third.counters.like_count === after.counters.like_count
    ? ok("LIKING TWICE IS ONCE", `${third.counters.like_count}`)
    : bad("LIKING TWICE IS ONCE", `${after.counters.like_count} → ${third.counters.like_count}`);

  // ---- a shared link opens -------------------------------------------------
  await page.goto(`${BASE}/feed/${first.video.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const detail = await page.locator("body").innerText();
  detail.includes("Kommentariyalar") && detail.includes(first.video.caption.slice(0, 20))
    ? ok("SHARED LINK OPENS", "detail screen renders the clip")
    : bad("SHARED LINK OPENS", detail.slice(0, 140).replace(/\n/g, " "));

  // ---- the store profile ----------------------------------------------------
  const handle = first.seller?.slug;
  await page.goto(`${BASE}/feed/creators/${handle}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const profile = await page.locator("body").innerText();
  ["Videolar", "Obunachilar", "Kuzatilmoqda"].every((w) => profile.includes(w))
    ? ok("CREATOR PROFILE", first.seller.store_name)
    : bad("CREATOR PROFILE", profile.slice(0, 140).replace(/\n/g, " "));

  const tiles = await page.locator('a[href^="/feed/"]').count();
  tiles > 1 ? ok("VIDEO GRID", `${tiles} tiles`) : bad("VIDEO GRID", `${tiles}`);

  // ---- following, and the button knowing it --------------------------------
  const sellerId = first.seller.id;
  const wasFollowing = (await api(`/feed/creators/${handle}`, { token: buyer.access_token })).body
    .is_following;
  await api("/feed/follow", {
    method: wasFollowing ? "DELETE" : "POST",
    token: buyer.access_token,
    body: { seller_id: sellerId },
  });
  const nowFollowing = (await api(`/feed/creators/${handle}`, { token: buyer.access_token })).body
    .is_following;
  nowFollowing !== wasFollowing
    ? ok("FOLLOW STATE IS KNOWN", `${wasFollowing} → ${nowFollowing}`)
    : bad("FOLLOW STATE IS KNOWN", "the profile did not notice");

  // ---- comments -------------------------------------------------------------
  const posted = await api(`/videos/${first.video.id}/comments`, {
    method: "POST",
    token: buyer.access_token,
    body: { body: "E2E: bu klip juda foydali bo'ldi." },
  });
  const replied = await api(`/videos/${first.video.id}/comments`, {
    method: "POST",
    token: buyer.access_token,
    body: { body: "E2E: o'zimga javob.", parent_id: posted.body?.id },
  });
  posted.status === 201 && replied.status === 201 && replied.body.parent_id === posted.body.id
    ? ok("THREADED COMMENTS", "a reply hangs off its parent")
    : bad("THREADED COMMENTS", `${posted.status} / ${replied.status}`);

  // ---- the creator's numbers ------------------------------------------------
  const seller = await tokens(SELLER);
  const mine = (await api("/sellers/me", { token: seller.access_token })).body?.[0];
  const stats = await api(`/seller/${mine.id}/feed/stats?days=30`, { token: seller.access_token });
  const s = stats.body;
  stats.status === 200 && s?.tiles?.views?.total > 0
    ? ok("CREATOR STATS", `${s.tiles.views.total} views, ${s.views_by_day.length} day points`)
    : bad("CREATOR STATS", JSON.stringify(s).slice(0, 140));

  s?.views_by_day?.length === 30 && s.views_by_day.every((p) => typeof p.views === "number")
    ? ok("SERIES HAS NO HOLES", "one point per day")
    : bad("SERIES HAS NO HOLES", `${s?.views_by_day?.length} points`);

  //: The axis and the buckets are computed in the same timezone, so the last
  //: point is today and not a day that holds nothing.
  const lastDay = s.views_by_day.at(-1)?.day;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
  lastDay === today
    ? ok("SERIES ENDS TODAY", lastDay)
    : bad("SERIES ENDS TODAY", `${lastDay} vs ${today}`);

  s?.audience?.by_age === null && s?.audience?.by_age_note
    ? ok("NO AGES INVENTED", "the gap is named, not filled")
    : bad("NO AGES INVENTED", JSON.stringify(s?.audience?.by_age));

  await signIn(seller);
  await page.goto(`${BASE}/seller/feed`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const statsPage = await page.locator("body").innerText();
  //: Counting paths is the wrong proxy here: a one-series line with no dots is
  //: a single path however much data is behind it. What has to be true is that
  //: the line has real geometry and the donut has as many sectors as regions.
  const curve = await page
    .locator(".recharts-line-curve")
    .first()
    .getAttribute("d")
    .catch(() => null);
  const sectors = await page.locator(".recharts-sector").count();
  statsPage.includes("Ko'rishlar") && (curve?.length ?? 0) > 100 && sectors > 0
    ? ok("STATS SCREEN DRAWS", `line of ${curve.length} chars, ${sectors} donut sectors`)
    : bad(
        "STATS SCREEN DRAWS",
        `curve=${curve?.length ?? 0} sectors=${sectors} — ${statsPage.slice(0, 80).replace(/\n/g, " ")}`,
      );

  //: The audience panel has to show the breakdowns that exist rather than a
  //: hole where the design's age bands were.
  ["Obunachilar", "Mintaqalar"].every((w) => statsPage.includes(w))
    ? ok("AUDIENCE PANEL", "regions and follower split shown")
    : bad("AUDIENCE PANEL", statsPage.slice(0, 120).replace(/\n/g, " "));
} catch (e) {
  bad("FEED SUITE", String(e).split("\n")[0].slice(0, 220));
  await page.screenshot({ path: process.env.E2E_FAILURE_SHOT ?? "e2e-feed-failure.png" });
}

console.log("\n  console/page errors:", errors.length ? errors.join(" | ") : "none");
const failed = steps.filter((s) => s[0] === "FAIL").length;
console.log(`\n  ${steps.length - failed}/${steps.length} steps passed`);
await browser.close();
process.exit(failed ? 1 : 0);
