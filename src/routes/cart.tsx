import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FitBadge } from "@/components/avtoqism/FitBadge";
import { EmptyState, Page, PageTitle } from "@/components/avtoqism/Page";
import { ErrorState } from "@/components/avtoqism/States";
import { formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import {
  getAppliedPromoCode,
  setAppliedPromoCode,
  useCart,
  useRemoveCartItem,
  useSetCartQuantity,
} from "@/lib/query/commerce";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Savat — AVTOQISM" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Savatdagi mahsulotlar va yakuniy summa." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const t = useT();
  const { lang } = useLang();

  // The applied code is this component's state. It is seeded from the shared
  // store — which is plain memory, null on the server and on the first client
  // render — so coming back from checkout does not silently drop the code.
  const [applied, setApplied] = useState<string | null>(() => getAppliedPromoCode());
  const [draft, setDraft] = useState<string>(() => getAppliedPromoCode() ?? "");

  const cart = useCart(applied);
  const setQuantity = useSetCartQuantity();
  const removeItem = useRemoveCartItem();

  if (cart.isPending) {
    return (
      <Page>
        <PageTitle title={t("cart.title")} />
        <div className="grid gap-8 lg:grid-cols-[1.6fr_0.8fr]">
          <div className="space-y-px bg-border">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-32 animate-pulse bg-card" />
            ))}
          </div>
          <div className="h-64 animate-pulse bg-card" />
        </div>
      </Page>
    );
  }

  if (cart.isError) {
    return (
      <Page>
        <PageTitle title={t("cart.title")} />
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
      </Page>
    );
  }

  const data = cart.data;
  const busy = setQuantity.isPending || removeItem.isPending;
  /** True while the server re-prices the cart with a code just typed in. */
  const repricing = cart.isPlaceholderData;

  /**
   * A wrong code is not an error. The server answers with a normally-priced
   * cart plus `promo_code_error`, so the code goes into state either way and
   * the message is shown under the field.
   */
  const applyCode = (event: React.FormEvent) => {
    event.preventDefault();
    const code = draft.trim();
    if (!code) return;
    setApplied(code);
    setAppliedPromoCode(code);
  };

  const clearCode = () => {
    setDraft("");
    setApplied(null);
    setAppliedPromoCode(null);
  };

  if (data.item_count === 0) {
    return (
      <Page>
        <PageTitle title={t("cart.title")} />
        <EmptyState
          title={t("cart.empty")}
          subtitle={t("cart.emptySub")}
          action={
            <Link
              to="/marketplace"
              className="inline-flex bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              {t("cart.goShopping")}
            </Link>
          }
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageTitle title={t("cart.title")} subtitle={`${data.item_count} ${t("common.pcs")}`} />

      {data.blocking_issues.length > 0 && (
        <div role="alert" className="mb-8 border border-warning/40 bg-warning/10 p-5">
          <p className="inline-flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="size-4" /> {t("cart.issues")}
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
            {data.blocking_issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1.6fr_0.8fr]">
        {/* lines, grouped by seller */}
        <div className="space-y-8">
          {data.groups.map((group) => (
            <section key={group.seller.id} className="border border-border bg-card">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                <div>
                  <p className="font-semibold">{group.seller.store_name}</p>
                  <p className="type-caption">
                    {group.seller.district}, {group.seller.region}
                  </p>
                </div>
                <p className="type-caption">
                  {t("common.delivery")}:{" "}
                  <strong className="text-foreground">
                    {group.free_delivery_applied ? t("common.free") : formatSom(group.delivery_fee)}
                  </strong>
                </p>
              </header>

              <ul className="divide-y divide-border">
                {group.lines.map((line) => {
                  const discount = Number(line.discount);
                  const discounted = discount > 0 ? Number(line.line_total) - discount : null;
                  return (
                    <li key={line.id} className="flex gap-4 p-5">
                      <Link
                        to="/product/$productId"
                        params={{ productId: line.product_slug }}
                        className="size-24 shrink-0 overflow-hidden bg-muted"
                      >
                        {line.image_url ? (
                          <img
                            src={line.image_url}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : null}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link
                          to="/product/$productId"
                          params={{ productId: line.product_slug }}
                          className="type-h3 line-clamp-2 hover:text-primary"
                        >
                          {(lang === "uz" ? line.name_uz : line.name_ru) ?? line.name_uz}
                        </Link>

                        {line.compatibility && (
                          <div className="mt-2">
                            <FitBadge compatibility={line.compatibility} />
                          </div>
                        )}

                        {line.over_stock && (
                          <p className="mt-2 text-xs font-semibold text-destructive">
                            Omborda {line.available} {t("common.pcs")} qoldi
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="inline-flex items-center border border-border">
                            <button
                              type="button"
                              aria-label="Kamaytirish"
                              disabled={busy}
                              onClick={() =>
                                setQuantity.mutate({
                                  itemId: line.id,
                                  quantity: Math.max(1, line.quantity - 1),
                                })
                              }
                              className="px-3 py-2 disabled:opacity-40"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-10 text-center text-sm font-bold">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Ko'paytirish"
                              disabled={busy || line.quantity >= line.available}
                              onClick={() =>
                                setQuantity.mutate({
                                  itemId: line.id,
                                  quantity: line.quantity + 1,
                                })
                              }
                              className="px-3 py-2 disabled:opacity-40"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              removeItem.mutate(line.id, {
                                onError: (e) => toast.error((e as Error).message),
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" /> {t("common.remove")}
                          </button>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {discounted === null ? (
                          <p className="type-price">{formatSom(line.line_total)}</p>
                        ) : (
                          <p className="type-price text-success">
                            {formatSom(discounted)}
                            <span className="ml-2 text-xs font-normal text-muted-foreground line-through">
                              {formatSom(line.line_total)}
                            </span>
                          </p>
                        )}
                        {line.quantity > 1 && (
                          <p className="type-caption">
                            {formatSom(line.unit_price)} × {line.quantity}
                          </p>
                        )}
                        {line.promotion_title && (
                          <p className="type-caption mt-1 text-success">{line.promotion_title}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* summary — every figure comes from the server */}
        <aside className="border border-border bg-card p-6 lg:sticky lg:top-28">
          <h2 className="type-h3">{t("common.total")}</h2>

          {/* promo code */}
          <form onSubmit={applyCode} className="mt-5 border-t border-border pt-5">
            <label htmlFor="promo-code" className="type-label block text-muted-foreground">
              Promokod
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="promo-code"
                name="promo-code"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="KOD"
                aria-invalid={Boolean(data.promo_code_error)}
                aria-describedby={data.promo_code_error ? "promo-code-error" : undefined}
                className={cn(
                  "h-11 w-full min-w-0 border bg-surface px-3 text-sm uppercase outline-none transition-colors focus:border-primary",
                  data.promo_code_error ? "border-destructive" : "border-input",
                )}
              />
              <button
                type="submit"
                disabled={draft.trim().length === 0 || repricing}
                className="inline-flex h-11 shrink-0 items-center gap-2 bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {repricing && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Qo'llash
              </button>
            </div>
            {applied && (
              <button
                type="button"
                onClick={clearCode}
                className="mt-2 text-xs font-semibold text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Bekor qilish
              </button>
            )}
            {data.promo_code_error && (
              <p
                id="promo-code-error"
                role="status"
                className="mt-2 text-xs font-semibold text-destructive"
              >
                {data.promo_code_error}
              </p>
            )}
          </form>

          {data.applied_promotions.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
              {data.applied_promotions.map((promo) => (
                <li key={promo.promotion_id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">{promo.title}</span>
                    {promo.code && <span className="type-caption">{promo.code}</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-success">
                    {/* A free-delivery promotion takes nothing off the goods, so
                        printing its zero would read as "this did nothing". */}
                    {promo.kind === "FREE_DELIVERY"
                      ? "Bepul yetkazish"
                      : `− ${formatSom(promo.amount)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
            <Row label={t("cart.subtotal")} value={formatSom(data.subtotal)} />
            {Number(data.discount_total) !== 0 && (
              <Row
                label="Chegirma"
                value={`− ${formatSom(Math.abs(Number(data.discount_total)))}`}
                tone="success"
              />
            )}
            <Row
              label={t("cart.deliveryTotal")}
              value={
                Number(data.delivery_total) === 0
                  ? t("common.free")
                  : formatSom(data.delivery_total)
              }
            />
          </dl>
          <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
            <span className="font-semibold">{t("common.total")}</span>
            <span className="type-price-lg">{formatSom(data.grand_total)}</span>
          </div>

          <Link
            to="/checkout"
            className={cn(
              "mt-6 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
              data.blocking_issues.length > 0 && "pointer-events-none opacity-40",
            )}
            aria-disabled={data.blocking_issues.length > 0}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("cart.checkout")}
          </Link>

          <Link
            to="/marketplace"
            className="mt-3 block w-full border border-border-strong bg-card px-5 py-3 text-center text-sm font-semibold transition-colors hover:bg-muted"
          >
            {t("cart.goShopping")}
          </Link>
        </aside>
      </div>
    </Page>
  );
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | undefined;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-semibold", tone === "success" && "text-success")}>{value}</dd>
    </div>
  );
}
