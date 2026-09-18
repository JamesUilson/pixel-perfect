import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronRight, Gauge, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import cobalt from "@/assets/car-cobalt.jpg";
import { EmptyState, Page, PageTitle, SectionHead } from "@/components/avtoqism/Page";
import { ProductCard } from "@/components/avtoqism/ProductCard";
import { ErrorState, ProductGridSkeleton } from "@/components/avtoqism/States";
import { tokens } from "@/lib/api/client";
import { formatKm } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useProducts } from "@/lib/query/catalog";
import { useActiveVehicle, useRemoveVehicle, useSetPrimaryVehicle } from "@/lib/query/garage";
import { cn } from "@/lib/utils";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";

export const Route = createFileRoute("/garage/")({
  head: () => ({
    meta: [
      { title: "Mening garajim — AVTOQISM" },
      {
        name: "description",
        content: "Avtomobilingiz, uning ma'lumotlari va mos mahsulotlar bir joyda.",
      },
      { property: "og:title", content: "Mening garajim — AVTOQISM" },
    ],
  }),
  component: Garage,
});

function Garage() {
  const t = useT();
  const garage = useActiveVehicle();
  const setPrimary = useSetPrimaryVehicle();
  const remove = useRemoveVehicle();

  const compatible = useProducts({
    fits_my_car: garage.variantId ? true : undefined,
    size: 8,
  });

  if (!tokens.isAuthenticated()) {
    return <SignInRequired />;
  }

  if (garage.isPending) {
    return (
      <Page>
        <div className="h-[420px] animate-pulse bg-muted" />
      </Page>
    );
  }

  if (garage.isError) {
    return (
      <Page>
        <ErrorState error={garage.error} onRetry={() => void garage.refetch()} />
      </Page>
    );
  }

  const vehicles = garage.data ?? [];
  const active = garage.activeVehicle;

  return (
    <Page>
      <PageTitle
        eyebrow={t("garage.title")}
        title={active ? "Bu — sizning avtomobilingiz." : t("home.noCar")}
        action={
          <Link
            to="/garage/add"
            className="hidden items-center gap-2 border border-border-strong bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted md:inline-flex"
          >
            <Plus className="size-4" /> {t("garage.add")}
          </Link>
        }
      />

      {vehicles.length === 0 ? (
        <EmptyState
          title={t("home.noCar")}
          subtitle={t("home.noCarSub")}
          action={
            <Link
              to="/garage/add"
              className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> {t("garage.add")}
            </Link>
          }
        />
      ) : (
        <>
          {active && (
            <div className="grid overflow-hidden border border-border bg-card lg:grid-cols-[1.6fr_0.9fr]">
              <div className="min-h-[300px] overflow-hidden lg:min-h-[520px]">
                <img
                  src={active.photo_url ?? cobalt}
                  alt={active.variant.display_name}
                  className="size-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-between p-6 md:p-10">
                <div>
                  <span className="type-label inline-flex items-center gap-2 bg-success-soft px-3 py-2 text-success">
                    <Check className="size-4" /> {t("garage.active")}
                  </span>
                  <h2 className="type-h2 mt-8">{active.variant.display_name}</h2>
                  <p className="type-caption mt-2">
                    {active.year} · {active.variant.engine?.displacement_l ?? "—"} ·{" "}
                    {active.variant.transmission === "AUTOMATIC" ? "Avtomat" : "Mexanika"}
                  </p>

                  <dl className="mt-10 divide-y divide-border border-y border-border">
                    <Field label={t("garage.plate")} value={active.plate_number} />
                    <Field label={t("garage.color")} value={active.color} />
                    <Field label={t("garage.mileage")} value={formatKm(active.mileage_km)} />
                    <Field label={t("garage.vin")} value={active.vin_masked} />
                  </dl>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="border border-border p-4">
                    <Gauge className="mb-5 size-5 text-primary" />
                    <p className="type-caption">{t("garage.nextService")}</p>
                    <p className="mt-1 font-semibold">{formatKm(active.next_service_km)}</p>
                  </div>
                  <div className="border border-border p-4">
                    <ShieldCheck className="mb-5 size-5 text-primary" />
                    <p className="type-caption">Moslik</p>
                    <p className="mt-1 font-semibold">Faol</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {vehicles.length > 1 && (
            <div className="mt-10">
              <SectionHead title={t("garage.mine")} />
              <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    className={cn(
                      "bg-background p-5",
                      v.is_primary && "ring-1 ring-inset ring-primary",
                    )}
                  >
                    <p className="type-h3">{v.variant.display_name}</p>
                    <p className="type-caption mt-1">
                      {v.year}
                      {v.plate_number ? ` · ${v.plate_number}` : ""}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {!v.is_primary && (
                        <button
                          type="button"
                          disabled={setPrimary.isPending}
                          onClick={() =>
                            setPrimary.mutate(v.id, {
                              onError: (e) => toast.error((e as Error).message),
                            })
                          }
                          className="border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
                        >
                          {t("garage.setActive")}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (!window.confirm(t("garage.removeConfirm"))) return;
                          remove.mutate(v.id, {
                            onError: (e) => toast.error((e as Error).message),
                          });
                        }}
                        className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/5"
                      >
                        <Trash2 className="size-3.5" />
                        {t("common.remove")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link
            to="/garage/add"
            className="mt-4 flex w-full items-center justify-center gap-2 bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground md:hidden"
          >
            <Plus className="size-4" /> {t("garage.add")}
          </Link>

          <section className="mt-16 border-t border-border pt-14">
            <SectionHead
              eyebrow="Aniq tanlov"
              title={t("garage.compatible")}
              action={
                <Link
                  to="/marketplace"
                  search={{ fit: true }}
                  className="inline-flex items-center gap-1 text-sm font-semibold hover:text-primary"
                >
                  {t("common.viewAll")} <ChevronRight className="size-4" />
                </Link>
              }
            />
            {compatible.isPending ? (
              <ProductGridSkeleton count={4} />
            ) : compatible.isError ? (
              <ErrorState error={compatible.error} onRetry={() => void compatible.refetch()} />
            ) : (
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-8">
                {compatible.data.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Page>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 py-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value || "—"}</dd>
    </div>
  );
}
