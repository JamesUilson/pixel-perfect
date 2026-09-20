import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, Page, PageTitle } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState } from "@/components/avtoqism/States";
import { ApiError } from "@/lib/api/client";
import { useIsAuthenticated } from "@/lib/query/session";
import type { DeliveryMethod, PaymentMethod } from "@/lib/api/types";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useAppliedPromoCode, useCart, useCheckout } from "@/lib/query/commerce";
import { useMe } from "@/lib/query/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Rasmiylashtirish — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: Checkout,
});

/** Uzbek mobile numbers, in any of the shapes people actually type. */
const PHONE_RE = /^\+?998\d{9}$|^\d{9}$/;

type FormErrors = Partial<Record<string, string>>;

function Checkout() {
  const t = useT();
  const navigate = useNavigate();
  // The cart is re-read with the code the buyer applied there, so the total on
  // this page is the total the server will charge — never the undiscounted one.
  const promoCode = useAppliedPromoCode();
  const cart = useCart(promoCode);
  const me = useMe();
  const checkout = useCheckout();
  const signedIn = useIsAuthenticated();

  const [form, setForm] = useState({
    recipient_name: "",
    phone: "",
    region: "Toshkent",
    district: "",
    street: "",
    landmark: "",
    comment: "",
  });
  const [payment, setPayment] = useState<PaymentMethod>("CASH_ON_DELIVERY");
  const [delivery, setDelivery] = useState<DeliveryMethod>("COURIER_PARTNER");
  const [errors, setErrors] = useState<FormErrors>({});

  if (!signedIn) return <SignInRequired />;

  const set = (field: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  /** Client-side validation mirrors the server's; the server still decides. */
  const validate = (): boolean => {
    const next: FormErrors = {};
    if (form.recipient_name.trim().length < 2) next["recipient_name"] = t("checkout.required");
    if (!PHONE_RE.test(form.phone.replace(/[\s()-]/g, "")))
      next["phone"] = t("checkout.phoneInvalid");
    if (form.region.trim().length < 2) next["region"] = t("checkout.required");
    if (form.district.trim().length < 2) next["district"] = t("checkout.required");
    if (form.street.trim().length < 3) next["street"] = t("checkout.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    const digits = form.phone.replace(/\D/g, "");
    const phone = digits.length === 9 ? `+998${digits}` : `+${digits}`;

    checkout.mutate(
      {
        address: {
          recipient_name: form.recipient_name.trim(),
          phone,
          region: form.region.trim(),
          district: form.district.trim(),
          street: form.street.trim(),
          landmark: form.landmark.trim() || null,
        },
        payment_method: payment,
        delivery_method: delivery,
        comment: form.comment.trim() || null,
        promo_code: promoCode,
        return_url: null,
      },
      {
        onSuccess: (order) => {
          toast.success(t("checkout.done"), { description: order.number });
          if (order.payment_url && payment !== "CASH_ON_DELIVERY") {
            // A real gateway hands back an absolute URL; the sandbox hands back
            // a local path, which we simply show on the order page.
            if (order.payment_url.startsWith("http")) {
              window.location.href = order.payment_url;
              return;
            }
          }
          void navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === "out_of_stock") {
            toast.error(error.message);
            void cart.refetch();
            return;
          }
          toast.error((error as Error).message);
        },
      },
    );
  };

  if (cart.isPending) {
    return (
      <Page>
        <PageTitle title={t("checkout.title")} />
        <div className="h-96 animate-pulse bg-muted" />
      </Page>
    );
  }
  if (cart.isError) {
    return (
      <Page>
        <PageTitle title={t("checkout.title")} />
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
      </Page>
    );
  }
  if (cart.data.item_count === 0) {
    return (
      <Page>
        <PageTitle title={t("checkout.title")} />
        <EmptyState
          title={t("cart.empty")}
          subtitle={t("cart.emptySub")}
          action={
            <Link
              to="/marketplace"
              className="bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              {t("cart.goShopping")}
            </Link>
          }
        />
      </Page>
    );
  }

  const payments: { value: PaymentMethod; label: string }[] = [
    { value: "CASH_ON_DELIVERY", label: t("checkout.cash") },
    { value: "CLICK", label: t("checkout.click") },
    { value: "PAYME", label: t("checkout.payme") },
    { value: "CARD", label: t("checkout.card") },
  ];
  const deliveries: { value: DeliveryMethod; label: string }[] = [
    { value: "COURIER_PARTNER", label: t("checkout.courier") },
    { value: "SELLER_DELIVERY", label: t("checkout.sellerDelivery") },
    { value: "STORE_PICKUP", label: t("checkout.pickup") },
  ];

  return (
    <Page>
      <PageTitle eyebrow="AVTOQISM" title={t("checkout.title")} />

      <form
        onSubmit={submit}
        className="grid items-start gap-8 lg:grid-cols-[1.4fr_0.8fr]"
        noValidate
      >
        <div className="space-y-8">
          <fieldset className="border border-border bg-card p-6">
            <legend className="type-label px-2 text-muted-foreground">
              {t("checkout.contact")}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("checkout.name")}
                value={form.recipient_name}
                onChange={set("recipient_name")}
                error={errors["recipient_name"]}
                autoComplete="name"
                placeholder={me.data?.full_name ?? ""}
                required
              />
              <Field
                label={t("checkout.phone")}
                value={form.phone}
                onChange={set("phone")}
                error={errors["phone"]}
                autoComplete="tel"
                inputMode="tel"
                placeholder="+998 90 123 45 67"
                required
              />
            </div>
          </fieldset>

          <fieldset className="border border-border bg-card p-6">
            <legend className="type-label px-2 text-muted-foreground">
              {t("checkout.address")}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("checkout.region")}
                value={form.region}
                onChange={set("region")}
                error={errors["region"]}
                required
              />
              <Field
                label={t("checkout.district")}
                value={form.district}
                onChange={set("district")}
                error={errors["district"]}
                placeholder="Chilonzor"
                required
              />
              <div className="sm:col-span-2">
                <Field
                  label={t("checkout.street")}
                  value={form.street}
                  onChange={set("street")}
                  error={errors["street"]}
                  placeholder="Bunyodkor shoh ko'chasi 12"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label={`${t("checkout.landmark")} (${t("common.optional")})`}
                  value={form.landmark}
                  onChange={set("landmark")}
                  placeholder="Metro yonida"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="border border-border bg-card p-6">
            <legend className="type-label px-2 text-muted-foreground">
              {t("checkout.deliveryMethod")}
            </legend>
            <div className="grid gap-3">
              {deliveries.map((d) => (
                <Choice
                  key={d.value}
                  name="delivery"
                  label={d.label}
                  checked={delivery === d.value}
                  onChange={() => setDelivery(d.value)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="border border-border bg-card p-6">
            <legend className="type-label px-2 text-muted-foreground">
              {t("checkout.payment")}
            </legend>
            <div className="grid gap-3">
              {payments.map((p) => (
                <Choice
                  key={p.value}
                  name="payment"
                  label={p.label}
                  checked={payment === p.value}
                  onChange={() => setPayment(p.value)}
                />
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="type-label text-muted-foreground">{t("checkout.comment")}</span>
            <textarea
              value={form.comment}
              onChange={(e) => set("comment")(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-2 w-full border border-input bg-surface p-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </label>
        </div>

        {/* summary — recomputed by the server, shown read-only */}
        <aside className="border border-border bg-card p-6 lg:sticky lg:top-28">
          <h2 className="type-h3">{t("common.total")}</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {cart.data.groups.map((g) => (
              <li key={g.seller.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-muted-foreground">
                  {g.seller.store_name}
                </span>
                <span className="shrink-0 font-semibold">{formatSom(g.total)}</span>
              </li>
            ))}
          </ul>
          {cart.data.applied_promotions.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
              {cart.data.applied_promotions.map((promo) => (
                <li key={promo.promotion_id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">{promo.title}</span>
                    {promo.code && <span className="type-caption">{promo.code}</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-success">
                    {promo.kind === "FREE_DELIVERY"
                      ? "Bepul yetkazish"
                      : `− ${formatSom(promo.amount)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("cart.subtotal")}</dt>
              <dd className="font-semibold">{formatSom(cart.data.subtotal)}</dd>
            </div>
            {Number(cart.data.discount_total) !== 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Chegirma</dt>
                <dd className="font-semibold text-success">
                  − {formatSom(Math.abs(Number(cart.data.discount_total)))}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("cart.deliveryTotal")}</dt>
              <dd className="font-semibold">
                {Number(cart.data.delivery_total) === 0
                  ? t("common.free")
                  : formatSom(cart.data.delivery_total)}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
            <span className="font-semibold">{t("common.total")}</span>
            <span className="type-price-lg">{formatSom(cart.data.grand_total)}</span>
          </div>

          <button
            type="submit"
            disabled={checkout.isPending}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {checkout.isPending && <Loader2 className="size-4 animate-spin" />}
            {payment === "CASH_ON_DELIVERY" ? t("checkout.place") : t("checkout.payOnline")}
          </button>
          <p className="type-caption mt-3">
            Yakuniy summa server tomonidan hisoblanadi va buyurtma tasdiqlanganda o'zgarmaydi.
          </p>
        </aside>
      </form>
    </Page>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  inputMode,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  placeholder?: string | undefined;
  autoComplete?: string | undefined;
  inputMode?: "text" | "tel" | undefined;
  required?: boolean | undefined;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <label className="block" htmlFor={id}>
      <span className="type-label text-muted-foreground">{label}</span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        required={required}
        className={cn(
          "mt-2 h-12 w-full border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary",
          error ? "border-destructive" : "border-input",
        )}
      />
      {error && (
        <span
          id={`${id}-error`}
          role="alert"
          className="mt-1 block text-xs font-semibold text-destructive"
        >
          {error}
        </span>
      )}
    </label>
  );
}

function Choice({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 border px-4 py-3.5 text-sm font-semibold transition-colors",
        checked ? "border-primary bg-primary/5" : "border-border hover:border-border-strong",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}
