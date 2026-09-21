import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, Page, PageTitle } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState } from "@/components/avtoqism/States";
import { AddressPartsFields } from "@/components/avtoqism/delivery/AddressPartsFields";
import { ContactPicker } from "@/components/avtoqism/delivery/ContactPicker";
import { ChoiceRow, FormSection, Notice } from "@/components/avtoqism/delivery/Fields";
import {
  SavedAddressPicker,
  type SavedSelection,
} from "@/components/avtoqism/delivery/SavedAddressPicker";
import {
  PROMISE_DAYS,
  addressErrorsFromApi,
  addressPartsOf,
  addressPartsToPayload,
  calendarDayIso,
  emptyAddressParts,
  fieldErrorsFromApi,
  localDateOnly,
  parseCoordinate,
  promisedDateFromNow,
  pruneErrors,
  validateAddressParts,
  validationSummary,
  type AddressParts,
  type FieldErrors,
} from "@/components/avtoqism/delivery/address";
import {
  emptyContactDraft,
  resolveContact,
  validateContact,
  type ContactDraft,
} from "@/components/avtoqism/delivery/contact";
import { ApiError } from "@/lib/api/client";
import { useIsAuthenticated } from "@/lib/query/session";
import type { DeliveryMethod, PaymentMethod } from "@/lib/api/types";
import { formatDate, formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useAddresses } from "@/lib/query/addresses";
import type { CheckoutAddress } from "@/lib/query/commerce";
import { useAppliedPromoCode, useCart, useCheckout } from "@/lib/query/commerce";
import { useMe } from "@/lib/query/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Rasmiylashtirish — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: Checkout,
});

function Checkout() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  // The cart is re-read with the code the buyer applied there, so the total on
  // this page is the total the server will charge — never the undiscounted one.
  const promoCode = useAppliedPromoCode();
  const cart = useCart(promoCode);
  const me = useMe();
  const addresses = useAddresses();
  const checkout = useCheckout();
  const signedIn = useIsAuthenticated();

  /**
   * `undefined` means "the book has not loaded yet"; `null` is the buyer having
   * chosen "yangi manzil". Without the third state the default address could
   * never be preselected without stamping on a choice already made.
   */
  const [selection, setSelection] = useState<SavedSelection | undefined>(undefined);
  const [parts, setParts] = useState<AddressParts>(emptyAddressParts);
  const [contact, setContact] = useState<ContactDraft>(emptyContactDraft);
  const [contactSeeded, setContactSeeded] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [payment, setPayment] = useState<PaymentMethod>("CASH_ON_DELIVERY");
  const [delivery, setDelivery] = useState<DeliveryMethod>("COURIER_PARTNER");
  const [comment, setComment] = useState("");
  /** The form's own complaints and the server's, in one place, so a field shows
   *  at most one message and both kinds clear the same way. */
  const [errors, setErrors] = useState<FieldErrors>({});

  const savedAddresses = useMemo(() => addresses.data ?? [], [addresses.data]);

  useEffect(() => {
    if (selection !== undefined || addresses.data === undefined) return;
    const preferred = addresses.data.find((address) => address.is_default) ?? addresses.data[0];
    setSelection(preferred ? preferred.id : null);
  }, [addresses.data, selection]);

  useEffect(() => {
    if (contactSeeded || !me.data) return;
    setContact((draft) => ({
      ...draft,
      selfName: draft.selfName || me.data.full_name || "",
      selfPhone: draft.selfPhone || me.data.phone || "",
    }));
    setContactSeeded(true);
  }, [me.data, contactSeeded]);

  const resolved: SavedSelection = selection === undefined ? null : selection;
  const chosenAddress = savedAddresses.find((address) => address.id === resolved) ?? null;
  const usingNewAddress = chosenAddress === null;

  /* --- what the server said last time ------------------------------------- */
  const failure = checkout.error;
  const apiError = failure instanceof ApiError ? failure : null;
  const apiFieldErrors = useMemo(() => fieldErrorsFromApi(failure), [failure]);
  const serverSummary = validationSummary(apiFieldErrors);

  // A 422 names fields; they are merged into the same state the form's own
  // validation writes to, so typing clears a server complaint too.
  useEffect(() => {
    const named = addressErrorsFromApi(apiFieldErrors, "address.");
    const contactReason =
      apiFieldErrors["contact"] ??
      apiFieldErrors["contact.name"] ??
      apiFieldErrors["contact.phone"];
    if (Object.keys(named).length === 0 && !contactReason) return;
    setErrors((current) => ({
      ...current,
      ...named,
      ...(contactReason ? { contact_name: contactReason } : {}),
    }));
  }, [apiFieldErrors]);

  const outOfStock = apiError?.code === "out_of_stock" ? apiError : null;
  const notVerified = apiError?.code === "contact_not_verified" ? apiError : null;
  // The API only enforces this when `REQUIRE_VERIFIED_CONTACT` is on, so it is
  // said out loud but never used to block the button: the server is the gate.
  const contactUnverified =
    me.data !== undefined && !me.data.phone_verified && !me.data.email_verified;
  const otherFailure =
    apiError && !outOfStock && !notVerified && serverSummary.length === 0 ? apiError : null;

  const promisedDate = useMemo(() => localDateOnly(promisedDateFromNow()), []);

  if (!signedIn) return <SignInRequired />;

  /** Everything currently wrong, by the rules this side knows. */
  const failingNow = (nextParts: AddressParts, nextContact: ContactDraft): FieldErrors => ({
    ...validateContact(nextContact),
    ...(usingNewAddress ? validateAddressParts(nextParts) : {}),
  });

  const editParts = (next: AddressParts) => {
    setParts(next);
    setErrors((current) => pruneErrors(current, failingNow(next, contact)));
  };

  const editContact = (next: ContactDraft) => {
    setContact(next);
    setErrors((current) => pruneErrors(current, failingNow(parts, next)));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const next = failingNow(parts, contact);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const resolvedContact = resolveContact(contact);
    const address: CheckoutAddress = chosenAddress
      ? {
          // A saved address keeps the recipient it was saved with; the contact
          // block above still decides who the driver actually rings.
          recipient_name: chosenAddress.recipient_name,
          phone: chosenAddress.phone,
          region: chosenAddress.region,
          district: chosenAddress.district,
          street: chosenAddress.street,
          house: chosenAddress.house,
          entrance: chosenAddress.entrance,
          floor: chosenAddress.floor,
          apartment: chosenAddress.apartment,
          landmark: chosenAddress.landmark,
          lat: parseCoordinate(chosenAddress.lat),
          lng: parseCoordinate(chosenAddress.lng),
        }
      : {
          // A new address has no recipient of its own yet, so it takes the one
          // the contact block just named — one less near-duplicate pair.
          recipient_name: resolvedContact.name ?? "",
          phone: resolvedContact.phone ?? "",
          ...addressPartsToPayload(parts),
        };

    checkout.mutate(
      {
        address,
        contact: resolvedContact,
        payment_method: payment,
        delivery_method: delivery,
        comment: comment.trim() || null,
        promo_code: promoCode,
        return_url: null,
        // Re-saving a picked address would only create a duplicate.
        save_address: usingNewAddress && saveAddress,
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
          // Everything else is drawn in place, where the fields are; a toast
          // that names a field the buyer cannot see is no help.
          if (error instanceof ApiError && error.status === 422) return;
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

  const stockDetails = outOfStock?.details;
  const available =
    typeof stockDetails?.["available"] === "number" ? stockDetails["available"] : null;
  const requested =
    typeof stockDetails?.["requested"] === "number" ? stockDetails["requested"] : null;

  return (
    <Page>
      <PageTitle eyebrow="AVTOQISM" title={t("checkout.title")} />

      {(notVerified ?? contactUnverified) && (
        <div className="mb-8">
          <Notice
            tone="warning"
            title="Hisobingiz tasdiqlanmagan"
            action={
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <ShieldAlert className="size-4" /> Profilga o'tish
              </Link>
            }
          >
            {notVerified?.message ??
              "Buyurtma berishdan oldin telefon raqamingizni yoki e-pochtangizni tasdiqlang. Tasdiqlash kodini profil sahifasidan qayta so'rashingiz mumkin."}
          </Notice>
        </div>
      )}

      {cart.data.blocking_issues.length > 0 && (
        <div className="mb-8">
          <Notice
            tone="danger"
            title="Savatda hal qilinishi kerak bo'lgan qatorlar bor"
            action={
              <Link
                to="/cart"
                className="inline-flex border border-border-strong bg-card px-4 py-2.5 text-sm font-semibold"
              >
                {t("cart.title")}
              </Link>
            }
          >
            <ul className="list-disc space-y-1 pl-4">
              {cart.data.blocking_issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      <form
        onSubmit={submit}
        className="grid items-start gap-8 lg:grid-cols-[1.4fr_0.8fr]"
        noValidate
      >
        <div className="space-y-8">
          {outOfStock && (
            <Notice
              tone="danger"
              title="Omborda yetarli mahsulot qolmadi"
              action={
                <Link
                  to="/cart"
                  className="inline-flex border border-border-strong bg-card px-4 py-2.5 text-sm font-semibold"
                >
                  Savatni tahrirlash
                </Link>
              }
            >
              {outOfStock.message}
              {available !== null && requested !== null && (
                <span className="mt-1 block">
                  So'ralgan: {requested} {t("common.pcs")} · Qolgan: {available} {t("common.pcs")}
                </span>
              )}
            </Notice>
          )}

          {serverSummary.length > 0 && (
            <Notice tone="danger" title="Ba'zi maydonlar to'g'ri to'ldirilmagan">
              <ul className="list-disc space-y-1 pl-4">
                {serverSummary.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </Notice>
          )}

          {otherFailure && (
            <Notice tone="danger" title="Buyurtma rasmiylashtirilmadi">
              {otherFailure.message}
            </Notice>
          )}

          <FormSection legend={t("checkout.address")}>
            <div className="space-y-6">
              <SavedAddressPicker
                addresses={savedAddresses}
                selectedId={resolved}
                onSelect={setSelection}
                onEdit={(address) => {
                  setParts(addressPartsOf(address));
                  setSelection(null);
                }}
                isPending={addresses.isPending}
                error={addresses.error}
                onRetry={() => void addresses.refetch()}
              />

              {chosenAddress ? (
                <div className="border border-border bg-surface p-4">
                  <p className="text-sm font-semibold">{chosenAddress.line}</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <AddressRow label="Viloyat" value={chosenAddress.region} />
                    <AddressRow label="Tuman" value={chosenAddress.district} />
                    <AddressRow label="Ko'cha" value={chosenAddress.street} />
                    <AddressRow label="Uy" value={chosenAddress.house} />
                    <AddressRow label="Podyezd" value={chosenAddress.entrance} />
                    <AddressRow label="Qavat" value={chosenAddress.floor} />
                    <AddressRow label="Xonadon" value={chosenAddress.apartment} />
                    <AddressRow label="Mo'ljal" value={chosenAddress.landmark} />
                  </dl>
                  {errors["coordinates"] && (
                    <p role="alert" className="mt-3 text-xs font-semibold text-destructive">
                      {errors["coordinates"]}
                    </p>
                  )}
                  <p className="type-caption mt-3">
                    Bu manzilni faqat shu buyurtma uchun o'zgartirmoqchimisiz? Kartadagi «Nusxalab
                    tahrirlash» tugmasini bosing.
                  </p>
                </div>
              ) : (
                !addresses.isPending && (
                  <>
                    <AddressPartsFields
                      parts={parts}
                      errors={errors}
                      onChange={editParts}
                      disabled={checkout.isPending}
                    />
                    <label className="flex items-start gap-3 border border-border p-4 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(event) => setSaveAddress(event.target.checked)}
                        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                      />
                      <span>
                        Bu manzilni saqlab qo'ying
                        <span className="type-caption mt-0.5 block font-normal">
                          Keyingi buyurtmada uni bir marta bosib tanlaysiz.
                        </span>
                      </span>
                    </label>
                  </>
                )
              )}
            </div>
          </FormSection>

          <FormSection legend={t("checkout.contact")}>
            <ContactPicker
              draft={contact}
              onChange={editContact}
              errors={errors}
              profileName={me.data?.full_name ?? null}
              profilePhone={me.data?.phone ?? null}
            />
          </FormSection>

          <FormSection legend={t("checkout.deliveryMethod")}>
            <div className="grid gap-3">
              {deliveries.map((d) => (
                <ChoiceRow
                  key={d.value}
                  name="delivery"
                  label={d.label}
                  checked={delivery === d.value}
                  onChange={() => setDelivery(d.value)}
                />
              ))}
            </div>
          </FormSection>

          <FormSection legend={t("checkout.payment")}>
            <div className="grid gap-3">
              {payments.map((p) => (
                <ChoiceRow
                  key={p.value}
                  name="payment"
                  label={p.label}
                  checked={payment === p.value}
                  onChange={() => setPayment(p.value)}
                />
              ))}
            </div>
          </FormSection>

          <label className="block">
            <span className="type-label text-muted-foreground">{t("checkout.comment")}</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
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

          {/* A refused code is not an error — the cart is simply priced without
              it, and saying so here beats a surprise on the receipt. */}
          {cart.data.promo_code_error && (
            <div className="mt-5 border border-warning/40 bg-warning/10 p-3">
              <p className="text-xs font-semibold">
                Promokod {cart.data.promo_code ? `«${cart.data.promo_code}» ` : ""}qo'llanmadi
              </p>
              <p className="type-caption mt-1">{cart.data.promo_code_error}</p>
              <Link
                to="/cart"
                className="type-caption mt-2 inline-block font-semibold text-primary"
              >
                Savatda boshqa kod kiritish
              </Link>
            </div>
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

          {/* The promise is made before the button, not after it. */}
          <div className="mt-5 flex items-start gap-3 border border-primary/30 bg-primary/5 p-4">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">{PROMISE_DAYS} kun ichida yetkazamiz</p>
              <p className="type-caption mt-1">
                Taxminiy sana:{" "}
                <span className="font-semibold text-foreground">
                  {formatDate(calendarDayIso(promisedDate), lang)}
                </span>
                . Buyurtma holatini «Buyurtmalar» sahifasida kuzatib borasiz.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={checkout.isPending || addresses.isPending}
            className={cn(
              "mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
              "disabled:opacity-60",
            )}
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

/** One line of a picked address's breakdown; blanks are simply not drawn. */
function AddressRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 font-medium">{value}</dd>
    </div>
  );
}
