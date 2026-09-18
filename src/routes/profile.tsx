import { createFileRoute, Link } from "@tanstack/react-router";
import { CarFront, Globe, LogOut, Receipt, ShoppingBag } from "lucide-react";

import { Page, PageTitle } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState } from "@/components/avtoqism/States";
import { tokens } from "@/lib/api/client";
import { formatPhone } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useLogout, useMe } from "@/lib/query/auth";
import { useActiveVehicle } from "@/lib/query/garage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profil — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: Profile,
});

function Profile() {
  const t = useT();
  const { lang, setLang } = useLang();
  const me = useMe();
  const logout = useLogout();
  const { activeVehicle } = useActiveVehicle();

  if (!tokens.isAuthenticated()) return <SignInRequired />;

  if (me.isError) {
    return (
      <Page>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </Page>
    );
  }

  const user = me.data;

  return (
    <Page className="max-w-3xl">
      <PageTitle
        eyebrow={t("profile.title")}
        title={user?.full_name ?? t("profile.guest")}
        subtitle={user ? formatPhone(user.phone) || user.email || undefined : undefined}
      />

      {activeVehicle && (
        <Link
          to="/garage"
          className="flex items-center justify-between gap-4 border border-border bg-card p-5 transition-colors hover:bg-muted/50"
        >
          <span className="flex items-center gap-3">
            <CarFront className="size-5 text-primary" />
            <span>
              <span className="block font-semibold">{activeVehicle.variant.display_name}</span>
              <span className="type-caption">{t("garage.active")}</span>
            </span>
          </span>
        </Link>
      )}

      <nav className="mt-6 divide-y divide-border border-y border-border">
        <Item to="/orders" icon={Receipt} label={t("orders.title")} />
        <Item to="/cart" icon={ShoppingBag} label={t("cart.title")} />
        <Item to="/garage" icon={CarFront} label={t("garage.title")} />
      </nav>

      <section className="mt-10">
        <h2 className="type-h3 mb-4 inline-flex items-center gap-2">
          <Globe className="size-4" /> {t("profile.language")}
        </h2>
        <div className="inline-flex border border-border">
          {(["uz", "ru"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={cn(
                "px-5 py-2.5 text-sm font-semibold transition-colors",
                lang === l ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {l === "uz" ? "O'zbekcha" : "Русский"}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="mt-12 inline-flex items-center gap-2 border border-border px-5 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5"
      >
        <LogOut className="size-4" /> {t("auth.logout")}
      </button>
    </Page>
  );
}

function Item({
  to,
  icon: Icon,
  label,
}: {
  to: "/orders" | "/cart" | "/garage";
  icon: typeof Receipt;
  label: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 py-4 transition-colors hover:text-primary">
      <Icon className="size-5 text-muted-foreground" />
      <span className="font-semibold">{label}</span>
    </Link>
  );
}
