/**
 * Account settings, and the two layouts of the feed.
 *
 * The properties here are the ones a toggle can silently fail at: that
 * choosing a theme actually changes the document, that a preference survives
 * a new sign-in because it lives on the server and not in this browser, that
 * "end all others" leaves you holding the device you pressed it on, and that
 * a portrait clip does not stretch across a desktop monitor.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const API = process.env.E2E_API_URL ?? "http://127.0.0.1:8000/api/v1";
const EXEC = process.env.PLAYWRIGHT_CHROMIUM;

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

function phone() {
  return `+99890${String(Math.floor(Math.random() * 10 ** 7)).padStart(7, "0")}`;
}

/** A fresh verified buyer, and their password, for the security tests. */
async function freshBuyer() {
  const number = phone();
  const password = "Moshina7Qism";
  const created = await api("/auth/register", {
    method: "POST",
    body: {
      phone: number,
      password,
      full_name: "E2E Sozlama",
      region: "Toshkent",
      city: "Chilonzor",
      accept_terms: true,
    },
  });
  if (created.status !== 201) throw new Error(`register: ${created.status}`);
  const verified = await api("/auth/register/verify", {
    method: "POST",
    body: { identifier: number, code: created.body.verification.debug_code },
  });
  if (verified.status !== 200) throw new Error(`verify: ${verified.status}`);
  return { phone: number, password, ...verified.body.tokens };
}

async function login(identifier, password) {
  const { status, body } = await api("/auth/login", {
    method: "POST",
    body: { identifier, password },
  });
  if (status !== 200) throw new Error(`login: ${status}`);
  return body.tokens;
}

const browser = await chromium.launch(
  EXEC ? { executablePath: EXEC, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] },
);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
  const buyer = await freshBuyer();
  await signIn(buyer);

  // ---- the settings screen exists and is reachable -------------------------
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const text = await page.locator("body").innerText();
  const sections = [
    "Ko'rinish",
    "Til",
    "Maxsus imkoniyatlar",
    "Xavfsizlik",
    "Ulangan qurilmalar",
    "Bildirishnomalar",
    "Hisob",
  ];
  const missing = sections.filter((s) => !text.includes(s));
  missing.length === 0
    ? ok("SETTINGS SCREEN", `${sections.length} sections`)
    : bad("SETTINGS SCREEN", `missing: ${missing.join(", ")}`);

  // ---- a theme choice has to change the document ---------------------------
  //: The radio itself is sr-only inside its label — correct markup, since a
  //: real person clicks the card. So the test clicks the card too, which is
  //: also the only version of this that proves the label is wired to the input.
  const darkChoice = page.locator('label:has(input[type="radio"][value="dark"])').first();
  const hasDark = (await darkChoice.count()) > 0;
  if (hasDark) {
    await darkChoice.click();
    await page.waitForTimeout(600);
    const attr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    const cls = await page.evaluate(() => document.documentElement.className);
    attr === "dark" || cls.includes("dark")
      ? ok("THEME APPLIES", `data-theme=${attr}`)
      : bad("THEME APPLIES", `data-theme=${attr} class=${cls}`);
  } else {
    bad("THEME APPLIES", "no dark-theme radio in the appearance card");
  }

  // ---- a preference is server-side, so it survives a different browser -----
  const set = await api("/me/preferences", {
    method: "PATCH",
    token: buyer.access_token,
    body: { theme: "dark", language: "ru", larger_text: true },
  });
  const fresh = await login(buyer.phone, buyer.password);
  const read = await api("/me/preferences", { token: fresh.access_token });
  set.status === 200 &&
  read.body?.theme === "dark" &&
  read.body?.language === "ru" &&
  read.body?.larger_text === true
    ? ok("PREFERENCES FOLLOW THE PERSON", "server-side, not localStorage")
    : bad("PREFERENCES FOLLOW THE PERSON", JSON.stringify(read.body));

  // ---- sessions -------------------------------------------------------------
  const listed = await api("/me/sessions", { token: fresh.access_token });
  const rows = listed.body?.sessions ?? [];
  const current = rows.filter((s) => s.is_current);
  rows.length >= 2 && current.length === 1
    ? ok("SESSIONS LISTED", `${rows.length} devices, 1 marked current`)
    : bad("SESSIONS LISTED", `${rows.length} rows, ${current.length} current`);

  rows.every((s) => s.device)
    ? ok("DEVICE IS NAMED", rows[0]?.device ?? "")
    : bad("DEVICE IS NAMED", "a row has no device label");

  //: The button someone presses when they think they are compromised must not
  //: sign them out of the device they are pressing it on.
  const revoked = await api("/me/sessions/revoke-others", {
    method: "POST",
    token: fresh.access_token,
  });
  const after = await api("/me/sessions", { token: fresh.access_token });
  revoked.status === 200 &&
  after.status === 200 &&
  after.body.sessions.length === 1 &&
  after.body.sessions[0].is_current
    ? ok("REVOKE OTHERS KEEPS YOU IN", `${revoked.body.revoked} ended`)
    : bad("REVOKE OTHERS KEEPS YOU IN", `${revoked.status} / ${after.status}`);

  //: And the ones it ended are really ended, not just hidden from the list.
  const stale = await api("/me/sessions", { token: buyer.access_token });
  stale.status === 401
    ? ok("REVOKED TOKEN IS DEAD", "the access token stops too, not just refresh")
    : bad("REVOKED TOKEN IS DEAD", `got ${stale.status}`);

  // ---- password change -------------------------------------------------------
  const weak = await api("/auth/password/change", {
    method: "POST",
    token: fresh.access_token,
    body: { current_password: buyer.password, new_password: "password" },
  });
  weak.status === 422 && weak.body?.error?.code === "weak_password"
    ? ok("WEAK NEW PASSWORD REFUSED", weak.body.error.details.problems[0].slice(0, 46))
    : bad("WEAK NEW PASSWORD REFUSED", `${weak.status} ${JSON.stringify(weak.body).slice(0, 90)}`);

  const wrongCurrent = await api("/auth/password/change", {
    method: "POST",
    token: fresh.access_token,
    body: { current_password: "NotMyPassword9", new_password: "Boshqa7Parol" },
  });
  wrongCurrent.status >= 400
    ? ok("CURRENT PASSWORD REQUIRED", `${wrongCurrent.status}`)
    : bad("CURRENT PASSWORD REQUIRED", "it changed without the current one");

  // ---- forgetting a password --------------------------------------------------
  //: Login locks an account after repeated failures, so until this screen
  //: existed the person most likely to need a way back in had none.
  const forgetful = await freshBuyer();
  await page.goto(`${BASE}/password`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const recovery = await page.locator("body").innerText();
  recovery.includes("Parolni tiklash")
    ? ok("RECOVERY SCREEN", "reachable at /password")
    : bad("RECOVERY SCREEN", recovery.slice(0, 120).replace(/\n/g, " "));

  const linked = await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const fromLogin = await page.getByRole("link", { name: /Parolni unutdingizmi/ }).count();
  linked && fromLogin > 0
    ? ok("RECOVERY IS LINKED", "from the sign-in form")
    : bad("RECOVERY IS LINKED", `${fromLogin} links`);

  const asked = await api("/auth/password/forgot", {
    method: "POST",
    body: { identifier: forgetful.phone },
  });
  const resetWeak = await api("/auth/password/reset", {
    method: "POST",
    body: {
      identifier: forgetful.phone,
      code: asked.body?.debug_code,
      new_password: "12345678",
    },
  });
  resetWeak.status === 422 && resetWeak.body?.error?.code === "weak_password"
    ? ok("RESET REFUSES A WEAK PASSWORD", "the third door has the same lock")
    : bad("RESET REFUSES A WEAK PASSWORD", `${resetWeak.status}`);

  const resetGood = await api("/auth/password/reset", {
    method: "POST",
    body: {
      identifier: forgetful.phone,
      code: asked.body?.debug_code,
      new_password: "Boshqa9Parol",
    },
  });
  const signedIn = await api("/auth/login", {
    method: "POST",
    body: { identifier: forgetful.phone, password: "Boshqa9Parol" },
  });
  resetGood.status === 204 && signedIn.status === 200
    ? ok("RESET WORKS", "the new password signs in")
    : bad("RESET WORKS", `${resetGood.status} / ${signedIn.status}`);

  //: And it says nothing about whether the account exists.
  const unknown = await api("/auth/password/forgot", {
    method: "POST",
    body: { identifier: phone() },
  });
  unknown.status === asked.status && unknown.body?.sent === asked.body?.sent
    ? ok("RECOVERY DOES NOT ENUMERATE", "same answer for an unknown number")
    : bad("RECOVERY DOES NOT ENUMERATE", `${unknown.status} vs ${asked.status}`);

  // ---- the feed, at two widths -----------------------------------------------
  await page.goto(`${BASE}/feed`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const box = await page
    .locator("section[data-video-id] video, section[data-video-id] img")
    .first()
    .boundingBox();
  const vw = page.viewportSize().width;
  //: A 9:16 clip filling a 1440px monitor is either enormous or letterboxed.
  //: On the web it belongs in a centred column, as Instagram does it.
  box && box.width < vw * 0.6 && box.width > 200
    ? ok("DESKTOP CLIP IS A COLUMN", `${Math.round(box.width)}px of ${vw}px`)
    : bad("DESKTOP CLIP IS A COLUMN", box ? `${Math.round(box.width)}px of ${vw}px` : "no clip");

  const centred = box && Math.abs(box.x + box.width / 2 - vw / 2) < vw * 0.12;
  centred ? ok("CLIP IS CENTRED", "") : bad("CLIP IS CENTRED", box ? `x=${Math.round(box.x)}` : "");

  const stepButtons = await page.getByRole("button", { name: /video$/ }).count();
  stepButtons >= 2
    ? ok("PREV/NEXT ON DESKTOP", `${stepButtons} buttons`)
    : bad("PREV/NEXT ON DESKTOP", `${stepButtons}`);

  //: The rail stands beside the clip on a wide screen, not over it.
  const railBox = await page
    .locator("section[data-video-id] .lg\\:block button")
    .first()
    .boundingBox()
    .catch(() => null);
  if (railBox && box) {
    railBox.x >= box.x + box.width - 4
      ? ok(
          "RAIL SITS BESIDE THE CLIP",
          `rail at ${Math.round(railBox.x)}, clip ends ${Math.round(box.x + box.width)}`,
        )
      : bad("RAIL SITS BESIDE THE CLIP", `rail at ${Math.round(railBox.x)}`);
  } else {
    bad("RAIL SITS BESIDE THE CLIP", "rail not found");
  }

  // ---- and the phone layout is untouched --------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const phoneBox = await page
    .locator("section[data-video-id] video, section[data-video-id] img")
    .first()
    .boundingBox();
  phoneBox && phoneBox.width > 380
    ? ok("PHONE CLIP IS FULL BLEED", `${Math.round(phoneBox.width)}px of 390px`)
    : bad("PHONE CLIP IS FULL BLEED", phoneBox ? `${Math.round(phoneBox.width)}px` : "no clip");
} catch (e) {
  bad("SETTINGS SUITE", String(e).split("\n")[0].slice(0, 220));
  await page.screenshot({ path: process.env.E2E_FAILURE_SHOT ?? "e2e-settings-failure.png" });
}

console.log("\n  console/page errors:", errors.length ? errors.join(" | ") : "none");
const failed = steps.filter((s) => s[0] === "FAIL").length;
console.log(`\n  ${steps.length - failed}/${steps.length} steps passed`);
await browser.close();
process.exit(failed ? 1 : 0);
