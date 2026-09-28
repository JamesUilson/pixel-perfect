/**
 * Sozlamalar — one screen, seven cards, no tabs.
 *
 * Why one scrolling column rather than a tabbed panel: a settings screen is
 * something people arrive at knowing what they came for and leave the moment
 * they have it. Tabs hide six of the seven answers behind a guess about which
 * heading covers "make the text bigger". A column with a jump list shows all
 * seven names at once, is searchable with the browser's own find, and deep-links
 * by fragment.
 *
 * The order is deliberate and goes from cheapest to most serious. Appearance and
 * language change a preference; accessibility changes how the app behaves;
 * security changes a credential; devices and the account section can take things
 * away. Nobody reaches the irreversible one by accident on the way to the theme.
 *
 * Signed out, the top two cards still work — a visitor is entitled to a dark
 * screen and to Russian — and the rest is replaced by an invitation to sign in
 * rather than by controls that would fail on the first tap.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn } from "lucide-react";

import { Page, PageTitle } from "@/components/avtoqism/Page";
import { ErrorState } from "@/components/avtoqism/States";
import { VerificationPrompt } from "@/components/avtoqism/auth/VerificationPrompt";
import {
  ACCESSIBILITY_ID,
  AccessibilitySection,
} from "@/components/avtoqism/settings/AccessibilitySection";
import {
  ACCOUNT_ID,
  AccountSection,
  ClosedReceipt,
} from "@/components/avtoqism/settings/AccountSection";
import {
  APPEARANCE_ID,
  AppearanceSection,
  LANGUAGE_ID,
  LanguageSection,
} from "@/components/avtoqism/settings/AppearanceSection";
import { DEVICES_ID, DevicesSection } from "@/components/avtoqism/settings/DevicesSection";
import {
  NOTIFICATIONS_ID,
  NotificationsSection,
} from "@/components/avtoqism/settings/NotificationsSection";
import { SECURITY_ID, SecuritySection } from "@/components/avtoqism/settings/SecuritySection";
import { useT } from "@/lib/i18n";
import { useMe } from "@/lib/query/auth";
import type { AccountClosedOut } from "@/lib/query/settings";
import { useIsAuthenticated } from "@/lib/query/session";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Sozlamalar — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const t = useT();
  const signedIn = useIsAuthenticated();
  const me = useMe();
  /**
   * The answer to `DELETE /me`, held here rather than in the card that asked for
   * it: closing the account ends the session, and every signed-in section —
   * including that card — unmounts the moment it does.
   */
  const [closed, setClosed] = useState<AccountClosedOut | null>(null);

  /** The jump list. Only the sections actually on the page. */
  const sections: { id: string; label: string }[] = [
    { id: APPEARANCE_ID, label: t("settings.appearance") },
    { id: LANGUAGE_ID, label: t("settings.language") },
    { id: ACCESSIBILITY_ID, label: t("settings.a11y") },
    ...(signedIn
      ? [
          { id: SECURITY_ID, label: t("settings.security") },
          { id: DEVICES_ID, label: t("settings.devices") },
          { id: NOTIFICATIONS_ID, label: t("settings.notifications") },
          { id: ACCOUNT_ID, label: t("settings.account") },
        ]
      : []),
  ];

  if (closed !== null) {
    return (
      <Page className="max-w-2xl">
        <PageTitle eyebrow={t("settings.account")} title={t("settings.closeAccountDone")} />
        <ClosedReceipt result={closed} />
        <Link
          to="/"
          className="mt-6 inline-flex bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t("nav.home")}
        </Link>
      </Page>
    );
  }

  return (
    <Page className="max-w-5xl">
      <PageTitle
        eyebrow={t("profile.title")}
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
      />

      {/* An unverified account can reach every switch on this page, but it
          cannot check out — and this is a screen it will spend time on, so the
          way to fix that is offered here too. Renders nothing once verified. */}
      {signedIn && <VerificationPrompt user={me.data} onVerified={() => void me.refetch()} />}

      <div className="mt-8 grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
        {/* Anchors, not router links: they move within this page, so the
            browser's own fragment handling is exactly right and needs no code. */}
        <nav aria-label={t("settings.title")} className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border pb-4 lg:block lg:space-y-1 lg:border-b-0 lg:pb-0">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          <AppearanceSection />
          <LanguageSection />
          <AccessibilitySection />

          {signedIn ? (
            me.isError ? (
              <ErrorState error={me.error} onRetry={() => void me.refetch()} />
            ) : (
              <>
                <SecuritySection user={me.data} />
                <DevicesSection />
                <NotificationsSection />
                <AccountSection onClosed={setClosed} />
              </>
            )
          ) : (
            <SignedOutNote />
          )}
        </div>
      </div>
    </Page>
  );
}

/**
 * What a signed-out visitor is missing, named rather than hidden.
 *
 * The alternative — showing only the two cards that work — leaves somebody who
 * came looking for "sign out of my other devices" with no clue that this is the
 * right screen and they are simply not signed in.
 */
function SignedOutNote() {
  const t = useT();
  return (
    <section className="border border-dashed border-border bg-card px-6 py-10 text-center">
      <h2 className="type-h3">{t("auth.required")}</h2>
      <p className="type-caption mx-auto mt-2 max-w-sm">
        Xavfsizlik, ulangan qurilmalar, bildirishnomalar va hisob sozlamalari hisobingizga
        kirganingizdan keyin ochiladi. Ko'rinish, til va maxsus imkoniyatlar shu qurilmada hozir ham
        ishlaydi.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <LogIn className="size-4" aria-hidden /> {t("auth.login")}
        </Link>
        <Link
          to="/register"
          className="border border-border-strong bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
        >
          {t("auth.register")}
        </Link>
      </div>
    </section>
  );
}
