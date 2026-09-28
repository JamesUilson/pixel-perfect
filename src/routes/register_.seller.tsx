/**
 * Becoming a seller, from a standing start.
 *
 * Until now this was three unconnected screens: `/register` made an ordinary
 * account, a code arrived from somewhere, and `/seller/onboard` asked for store
 * details of somebody who was already signed in and already verified. Nothing
 * joined them, and the only sign that selling was possible at all was a line of
 * small print under the sign-in form.
 *
 * This route is the thread. It is one page with four steps — account,
 * verification, store details, review — and **the step is read off the
 * account's real state, never off a wizard counter**. That is what makes it
 * enterable part-way: somebody who already has an account signs in and lands on
 * verification or on the store form, whichever is actually left, and somebody
 * whose store already exists lands on the review panel rather than being asked
 * to open a second one. A reload does the same thing, because a reload asks the
 * same question of the same state.
 *
 * `register_.seller.tsx`, not `register.seller.tsx`: the trailing underscore
 * opts out of nesting under `/register`, which is a page with its own form and
 * no `<Outlet />` — the same reason `/seller/onboard` is `seller_.onboard.tsx`.
 *
 * Neither form here is a new one. The account fields are the ones `/register`
 * uses and the store fields are the ones `/seller/onboard` uses; both were
 * lifted into `components/avtoqism/account/` so that this page reuses them
 * rather than growing a second copy of a password policy or a second wording of
 * the approval warning.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Clock, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Page, PageTitle } from "@/components/avtoqism/Page";
import { AccountForm } from "@/components/avtoqism/account/AccountForm";
import type { RegistrationStart } from "@/components/avtoqism/account/AccountForm";
import { StoreCreatedCard, StoreDetailsForm } from "@/components/avtoqism/account/StoreDetailsForm";
import { VerificationCodeForm } from "@/components/avtoqism/auth/VerificationCodeForm";
import { VerificationPrompt } from "@/components/avtoqism/auth/VerificationPrompt";
import { Pill } from "@/components/avtoqism/panel/Widgets";
import { isUnverified, useMe } from "@/lib/query/auth";
import { useMyStores } from "@/lib/query/seller";
import type { SellerStore } from "@/lib/query/seller";
import { useIsAuthenticated } from "@/lib/query/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register_/seller")({
  head: () => ({
    meta: [
      { title: "Sotuvchi sifatida ro'yxatdan o'tish — AVTOQISM" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SellerRegisterPage,
});

const STEPS = [
  { key: "account", label: "Hisob", hint: "Ism, aloqa, parol" },
  { key: "verify", label: "Tasdiqlash", hint: "Olti xonali kod" },
  { key: "store", label: "Do'kon", hint: "Nomi va hududi" },
  { key: "review", label: "Ko'rik", hint: "Administrator tasdig'i" },
] as const;

type Step = (typeof STEPS)[number]["key"];

function SellerRegisterPage() {
  const signedIn = useIsAuthenticated();
  const me = useMe();
  const stores = useMyStores();
  const navigate = useNavigate();

  /** A code is on its way to somebody who had no account a moment ago. */
  const [started, setStarted] = useState<RegistrationStart | null>(null);
  const [created, setCreated] = useState<SellerStore | null>(null);
  /** They already have a store and said they want another one anyway. */
  const [openAnother, setOpenAnother] = useState(false);

  const account = me.data;
  const verified = signedIn && account !== undefined && !isUnverified(account);
  const myStores = stores.data ?? [];

  /*
   * The step, derived — not stored. Storing it is what makes a wizard lie to
   * somebody who reloads, or who arrives already halfway through.
   */
  const step: Step = created
    ? "review"
    : verified
      ? "store"
      : signedIn || started !== null
        ? "verify"
        : "account";

  const loadingAccount = signedIn && me.isPending;
  /** Still on screen, or one "wrong number?" away from being wanted again. */
  const keepAccountMounted = step === "account" || (step === "verify" && started !== null);

  return (
    <Page className="max-w-2xl">
      <PageTitle
        eyebrow="AVTOQISM"
        title="Sotuvchi sifatida ro'yxatdan o'tish"
        subtitle="To'rt qadam: hisob, tasdiqlash, do'kon ma'lumotlari va administrator ko'rigi."
      />

      {/*
       * Before a single field. The backend opens every new store `PENDING`, and
       * finding that out after filling in a name, a district and a map point is
       * a way to lose somebody's afternoon.
       */}
      <div className="flex items-start gap-3 border border-warning/40 bg-warning/10 px-4 py-3">
        <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <p className="type-caption">
          Do'kon darhol sota boshlamaydi. Yangi do'kon «Tasdiqlanmoqda» holatida ochiladi va
          administrator ko'rigidan o'tgach katalogda ko'rinadi. Ko'rikni kutayotganda ham mahsulot
          qo'shishingiz, ombor ochishingiz va narx belgilashingiz mumkin. Ro'yxatdan o'tish bepul,
          komissiya faqat sotuvdan olinadi.
        </p>
      </div>

      <StepBar current={step} className="mt-8" />

      <div className="mt-8">
        {loadingAccount ? (
          <div className="space-y-4">
            <div className="h-12 animate-pulse bg-muted" />
            <div className="h-40 animate-pulse bg-muted" />
          </div>
        ) : (
          <>
            {/*
             * The account step is kept mounted behind the code box rather than
             * swapped out for it, because "Boshqa raqam kiritish" has to come
             * back to a filled-in form. Unmounting would take the name, the
             * region and the chosen channel with it and make correcting one
             * digit cost the whole form again.
             */}
            {keepAccountMounted && (
              <div className={cn(step !== "account" && "hidden")}>
                <AccountStep onStarted={setStarted} />
              </div>
            )}

            {step === "verify" && (
              <VerifyStep
                started={started}
                onChangeIdentifier={() => setStarted(null)}
                onVerified={() => void me.refetch()}
              />
            )}

            {step === "store" && (
              <StoreStep
                stores={myStores}
                loading={stores.isPending}
                openAnother={openAnother}
                onOpenAnother={() => setOpenAnother(true)}
                onCreated={setCreated}
              />
            )}

            {step === "review" && created && (
              <StoreCreatedCard
                seller={created}
                onFinish={() => void navigate({ to: "/seller" })}
              />
            )}
          </>
        )}
      </div>
    </Page>
  );
}

/* --- the steps ---------------------------------------------------------------- */
function AccountStep({ onStarted }: { onStarted: (result: RegistrationStart) => void }) {
  return (
    <section aria-labelledby="seller-account-title">
      <h2 id="seller-account-title" className="type-h2">
        1. Hisob yarating
      </h2>
      <p className="type-caption mt-2">
        Do'kon shu hisobga biriktiriladi. Xarid qilish uchun ham shu hisob ishlaydi — ikkinchisi
        kerak emas.
      </p>

      <div className="mt-6">
        <AccountForm onStarted={onStarted} />
      </div>

      {/*
       * The other way in. Somebody who registered as a buyer last month and has
       * now decided to sell must not be told to register again — they sign in
       * and this page picks them up at whichever step they are actually on.
       */}
      <div className="mt-8 border border-border bg-card p-5">
        <p className="text-sm font-semibold">Hisobingiz bormi?</p>
        <p className="type-caption mt-1">
          Kiring — shu sahifaga qaytasiz va qolgan qadamdan davom etasiz. Qaytadan ro'yxatdan o'tish
          kerak emas.
        </p>
        <Link
          to="/login"
          search={{ next: "/register/seller" }}
          className="mt-4 inline-flex w-full items-center justify-center border border-border-strong bg-surface px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Kirish
        </Link>
      </div>
    </section>
  );
}

/**
 * Two ways into the same step.
 *
 * Somebody who has just registered here has a code in flight and an identifier
 * to show, so the code box goes straight up. Somebody who arrived signed in and
 * unverified has neither — `VerificationPrompt` asks the server for a code
 * first, and it is the same component the profile and sign-in screens use, so
 * the cooldown and the attempt counter behave identically wherever they are met.
 */
function VerifyStep({
  started,
  onChangeIdentifier,
  onVerified,
}: {
  started: RegistrationStart | null;
  onChangeIdentifier: () => void;
  onVerified: () => void;
}) {
  const me = useMe();

  return (
    <section aria-labelledby="seller-verify-title">
      <h2 id="seller-verify-title" className="type-h2">
        2. Aloqa raqamini tasdiqlang
      </h2>
      <p className="type-caption mt-2">
        Do'kon ochish uchun tasdiqlangan aloqa shart — server tasdiqlanmagan hisobdan do'konni qabul
        qilmaydi.
      </p>

      {started !== null ? (
        <div className="mt-6 border border-border bg-card p-5">
          <VerificationCodeForm
            identifier={started.identifier}
            initialResendAfter={started.resendAfter}
            onVerified={() => {
              toast.success("Hisobingiz tasdiqlandi.");
              onVerified();
            }}
            onChangeIdentifier={onChangeIdentifier}
          />
        </div>
      ) : (
        <VerificationPrompt
          user={me.data}
          onVerified={() => {
            toast.success("Hisobingiz tasdiqlandi.");
            onVerified();
          }}
          className="mt-6 border border-warning/40 bg-warning/10 p-5"
        />
      )}
    </section>
  );
}

function StoreStep({
  stores,
  loading,
  openAnother,
  onOpenAnother,
  onCreated,
}: {
  stores: SellerStore[];
  /** `/sellers/me` has not answered yet. */
  loading: boolean;
  openAnother: boolean;
  onOpenAnother: () => void;
  onCreated: (seller: SellerStore) => void;
}) {
  const hasStores = stores.length > 0;

  // Whether this person already has a store decides which of two screens this
  // is, so it is worth the wait: drawing the form first and swapping it for the
  // other panel a moment later would throw away whatever they had begun typing.
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse bg-muted" />
        <div className="h-40 animate-pulse bg-muted" />
      </div>
    );
  }

  // Somebody who already has a store did not need this path at all, and the
  // honest thing is to show them the store they have rather than a blank form
  // that would quietly open a second one.
  if (hasStores && !openAnother) {
    return (
      <section aria-labelledby="seller-store-title">
        <h2 id="seller-store-title" className="type-h2">
          Sizda do'kon bor
        </h2>
        <p className="type-caption mt-2">
          Bu hisobga do'kon allaqachon biriktirilgan. Sotuvchi panelidan mahsulot qo'shasiz, narx
          belgilaysiz va buyurtmalarni ko'rasiz.
        </p>

        <ul className="mt-6 divide-y divide-border border-y border-border">
          {stores.map((store) => (
            <li key={store.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden bg-muted">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt="" className="size-full object-cover" />
                  ) : (
                    <Store className="size-4 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{store.store_name}</span>
                  <span className="type-caption block truncate">
                    {store.region}, {store.district}
                  </span>
                </span>
              </span>
              <StoreStatusPill status={store.status} />
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/seller"
            className="inline-flex items-center justify-center bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sotuvchi paneliga o'tish
          </Link>
          <button
            type="button"
            onClick={onOpenAnother}
            className="inline-flex items-center justify-center border border-border-strong bg-surface px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Yana bitta do'kon ochish
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="seller-store-title">
      <h2 id="seller-store-title" className="type-h2">
        3. Do'kon ma'lumotlari
      </h2>
      <p className="type-caption mt-2">
        Bu ma'lumotlar xaridorlarga ko'rinadi. Keyinroq sotuvchi panelidan o'zgartirasiz.
      </p>

      {/* The account is verified by the time this step is on screen — the step
          is derived from exactly that — so the form is never in its disabled
          state here. */}
      <StoreDetailsForm
        unverified={false}
        alreadyHasStores={hasStores}
        onCreated={onCreated}
        className="mt-6 space-y-4"
      />
    </section>
  );
}

/** The store's own words for where it stands. */
function StoreStatusPill({ status }: { status: SellerStore["status"] }) {
  switch (status) {
    case "ACTIVE":
      return <Pill tone="good">Faol</Pill>;
    case "PENDING":
      return <Pill tone="warning">Tasdiqlanmoqda</Pill>;
    case "SUSPENDED":
      return <Pill tone="critical">To'xtatilgan</Pill>;
    case "REJECTED":
      return <Pill tone="critical">Rad etilgan</Pill>;
    default:
      return <Pill>{status}</Pill>;
  }
}

/* --- the thread between the steps --------------------------------------------- */
/**
 * Where they are, and what is still ahead.
 *
 * Ordered list rather than four styled divs: it is a sequence, a screen reader
 * should hear it as one, and `aria-current` is what says which of them is now.
 */
function StepBar({ current, className }: { current: Step; className?: string | undefined }) {
  const index = STEPS.findIndex((step) => step.key === current);

  return (
    <ol className={cn("grid grid-cols-2 gap-px bg-border sm:grid-cols-4", className)}>
      {STEPS.map((step, position) => {
        const done = position < index;
        const now = position === index;
        return (
          <li
            key={step.key}
            aria-current={now ? "step" : undefined}
            className={cn(
              "bg-card p-4",
              now && "bg-foreground text-background",
              done && "bg-muted",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center text-[11px] font-bold",
                  now
                    ? "bg-background text-foreground"
                    : done
                      ? "bg-success text-success-foreground"
                      : "bg-muted",
                )}
              >
                {done ? <Check className="size-3" /> : position + 1}
              </span>
              {step.label}
            </span>
            <span
              className={cn("mt-1 block text-xs", now ? "opacity-80" : "text-muted-foreground")}
            >
              {step.hint}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
