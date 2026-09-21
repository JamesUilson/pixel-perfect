/**
 * The saved-address manager on the profile screen.
 *
 * Built out of the panel parts so it reads as the same kind of thing as the
 * payout-card list in `seller.finance.tsx`: a titled section, one card per row,
 * the destructive action behind an inline confirmation rather than a dialog the
 * finger can miss.
 */
import { useEffect, useMemo, useState } from "react";
import { MapPin, Star } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import { Button, Panel, Pill } from "@/components/avtoqism/panel/Widgets";
import { formatPhone } from "@/lib/format";
import {
  MAX_ADDRESSES,
  useAddresses,
  useCreateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
  useUpdateAddress,
  type AddressInput,
  type AddressOut,
} from "@/lib/query/addresses";
import { AddressPartsFields } from "./AddressPartsFields";
import { Notice, TextField } from "./Fields";
import {
  PHONE_RE,
  addressErrorsFromApi,
  addressPartsOf,
  addressPartsToPayload,
  emptyAddressParts,
  fieldErrorsFromApi,
  normalisePhone,
  parseCoordinate,
  pruneErrors,
  validateAddressParts,
  validationSummary,
  type AddressParts,
  type FieldErrors,
} from "./address";

type Editing = { mode: "new" } | { mode: "edit"; address: AddressOut };

export function AddressBook() {
  const addresses = useAddresses();
  const setDefault = useSetDefaultAddress();
  const remove = useDeleteAddress();

  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const rows = addresses.data ?? [];
  const full = rows.length >= MAX_ADDRESSES;

  return (
    <PanelSection
      title="Yetkazish manzillari"
      subtitle="Rasmiylashtirishda shu manzillardan birini tanlaysiz."
      action={
        <Button size="sm" disabled={full} onClick={() => setEditing({ mode: "new" })}>
          Manzil qo'shish
        </Button>
      }
    >
      {addresses.isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 2 }, (_, index) => (
            <LineSkeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : addresses.isError ? (
        <div className="p-5">
          <ErrorState error={addresses.error} onRetry={() => void addresses.refetch()} compact />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <p className="type-caption">
            Hali manzil saqlanmagan. Birinchi manzilni qo'shsangiz, keyingi buyurtmalarda uni bir
            marta bosib tanlaysiz.
          </p>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => setEditing({ mode: "new" })}>Manzil qo'shish</Button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-px bg-border sm:grid-cols-2">
          {rows.map((address) => {
            const hasPin =
              parseCoordinate(address.lat) !== null && parseCoordinate(address.lng) !== null;
            const defaultBusy = setDefault.isPending && setDefault.variables === address.id;
            const removeBusy = remove.isPending && remove.variables === address.id;
            const defaultError =
              setDefault.isError && setDefault.variables === address.id
                ? setDefault.error.message
                : null;
            const removeError =
              remove.isError && remove.variables === address.id ? remove.error.message : null;

            return (
              <li key={address.id} className="bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{address.label ?? address.district}</span>
                  {address.is_default && (
                    <Pill tone="info">
                      <Star className="size-3" /> Asosiy
                    </Pill>
                  )}
                  {hasPin && (
                    <Pill tone="good">
                      <MapPin className="size-3" /> Nuqta
                    </Pill>
                  )}
                </div>
                <p className="type-caption mt-1">{address.line}</p>
                <p className="type-caption mt-1">
                  {address.recipient_name} · {formatPhone(address.phone) || address.phone}
                </p>

                {confirmingId === address.id ? (
                  <div className="mt-3 border border-destructive/40 bg-destructive/8 p-3">
                    <p className="text-sm">Bu manzil o'chiriladi. Davom etamizmi?</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={removeBusy}
                        onClick={() =>
                          remove.mutate(address.id, { onSuccess: () => setConfirmingId(null) })
                        }
                      >
                        {removeBusy ? "O'chirilmoqda…" : "Ha, o'chirilsin"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>
                        Bekor qilish
                      </Button>
                    </div>
                    {removeError && <p className="mt-2 text-sm text-destructive">{removeError}</p>}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing({ mode: "edit", address })}
                    >
                      Tahrirlash
                    </Button>
                    {!address.is_default && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={defaultBusy}
                        onClick={() => setDefault.mutate(address.id)}
                      >
                        {defaultBusy ? "Saqlanmoqda…" : "Asosiy qilish"}
                      </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => setConfirmingId(address.id)}>
                      O'chirish
                    </Button>
                  </div>
                )}

                {defaultError && <p className="mt-2 text-sm text-destructive">{defaultError}</p>}
                {removeError && confirmingId !== address.id && (
                  <p className="mt-2 text-sm text-destructive">{removeError}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {full && (
        <p className="type-caption border-t border-border px-5 py-3">
          Ko'pi bilan {MAX_ADDRESSES} ta manzil saqlash mumkin. Yangisini qo'shish uchun birini
          o'chiring.
        </p>
      )}

      <Panel
        open={editing !== null}
        title={editing?.mode === "edit" ? "Manzilni tahrirlash" : "Yangi manzil"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <AddressForm
            // Remounts on switching rows, so no draft leaks between addresses.
            key={editing.mode === "edit" ? editing.address.id : "new"}
            address={editing.mode === "edit" ? editing.address : null}
            isFirst={rows.length === 0}
            onDone={() => setEditing(null)}
          />
        )}
      </Panel>
    </PanelSection>
  );
}

function AddressForm({
  address,
  isFirst,
  onDone,
}: {
  address: AddressOut | null;
  isFirst: boolean;
  onDone: () => void;
}) {
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const pending = create.isPending || update.isPending;
  const failure = create.error ?? update.error;

  const [label, setLabel] = useState(address?.label ?? "");
  const [recipient, setRecipient] = useState(address?.recipient_name ?? "");
  const [phone, setPhone] = useState(address?.phone ?? "");
  const [parts, setParts] = useState<AddressParts>(() =>
    address ? addressPartsOf(address) : emptyAddressParts(),
  );
  // The very first address is the default whether the box is ticked or not, so
  // it is ticked and locked rather than quietly overridden by the server.
  const [isDefault, setIsDefault] = useState(address?.is_default ?? isFirst);
  const [errors, setErrors] = useState<FieldErrors>({});

  const apiErrors = useMemo(() => fieldErrorsFromApi(failure), [failure]);
  const summary = validationSummary(apiErrors);

  // The server's complaints join the form's own, so a field carries one message
  // and both kinds clear as soon as the field is corrected.
  useEffect(() => {
    const named = addressErrorsFromApi(apiErrors);
    if (Object.keys(named).length === 0) return;
    setErrors((current) => ({ ...current, ...named }));
  }, [apiErrors]);

  const failingNow = (
    nextParts: AddressParts,
    nextRecipient: string,
    nextPhone: string,
  ): FieldErrors => {
    const next = validateAddressParts(nextParts);
    if (nextRecipient.trim().length < 2) next["recipient_name"] = "Ism familiyani kiriting";
    if (!PHONE_RE.test(nextPhone.replace(/[\s()-]/g, "")))
      next["phone"] = "Telefon raqami noto'g'ri";
    return next;
  };

  const prune = (nextParts: AddressParts, nextRecipient: string, nextPhone: string) =>
    setErrors((current) => pruneErrors(current, failingNow(nextParts, nextRecipient, nextPhone)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = failingNow(parts, recipient, phone);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: AddressInput = {
      label: label.trim() === "" ? null : label.trim(),
      recipient_name: recipient.trim(),
      phone: normalisePhone(phone),
      ...addressPartsToPayload(parts),
      is_default: isDefault,
    };

    if (address) update.mutate({ id: address.id, input }, { onSuccess: onDone });
    else create.mutate(input, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {failure && summary.length === 0 && (
        <Notice tone="danger" title="Manzil saqlanmadi">
          {failure.message}
        </Notice>
      )}
      {summary.length > 0 && (
        <Notice tone="danger" title="Ba'zi maydonlar to'g'ri to'ldirilmagan">
          <ul className="list-disc space-y-1 pl-4">
            {summary.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nomi (ixtiyoriy)"
          value={label}
          onChange={setLabel}
          error={errors["label"]}
          maxLength={60}
          placeholder="Uy, Ustaxona"
          disabled={pending}
        />
        <TextField
          label="Qabul qiluvchi"
          value={recipient}
          onChange={(value) => {
            setRecipient(value);
            prune(parts, value, phone);
          }}
          error={errors["recipient_name"]}
          autoComplete="name"
          maxLength={120}
          disabled={pending}
          required
        />
        <TextField
          className="sm:col-span-2"
          label="Telefon"
          value={phone}
          onChange={(value) => {
            setPhone(value);
            prune(parts, recipient, value);
          }}
          error={errors["phone"]}
          autoComplete="tel"
          inputMode="tel"
          placeholder="+998 90 123 45 67"
          disabled={pending}
          required
        />
      </div>

      <AddressPartsFields
        parts={parts}
        errors={errors}
        onChange={(next) => {
          setParts(next);
          prune(next, recipient, phone);
        }}
        disabled={pending}
      />

      <label className="flex items-start gap-3 border border-border p-4 text-sm font-semibold">
        <input
          type="checkbox"
          checked={isDefault}
          disabled={pending || isFirst}
          onChange={(event) => setIsDefault(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
        />
        <span>
          Asosiy manzil
          <span className="type-caption mt-0.5 block font-normal">
            {isFirst
              ? "Birinchi manzil avtomatik asosiy bo'ladi."
              : "Rasmiylashtirishda shu manzil oldindan tanlanadi."}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}
