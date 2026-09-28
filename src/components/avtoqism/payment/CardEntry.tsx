/**
 * The three things a card is added with, and the picture of the card.
 *
 * Shared by `/wallet` (a buyer's top-up card) and `/seller/finance` (a seller's
 * payout card) because they are the same object with the same promise, and two
 * copies of a payment form is how the two drift apart.
 *
 * The expiry is chosen, never typed. Month and year are the two fields on this
 * form where free text buys nothing — there are twelve valid months and about
 * ten plausible years — and where a typo costs a round trip to the tokeniser
 * and an error the person has to decode. Two selects make that whole class of
 * failed submission impossible to produce.
 *
 * The field order follows the card, top to bottom: number, then the name, then
 * the expiry. The preview above is the same information in the same order, so
 * the eye checks one against the other without jumping.
 *
 * This component holds the draft; it does not submit it. The caller owns the
 * mutation and owns clearing `number` the moment the request settles.
 */
import { Field, Input, Select } from "@/components/avtoqism/panel/Widgets";
import { CardPreview } from "./CardPreview";
import {
  BRAND_LABEL,
  EXPIRY_MONTHS,
  cardDigits,
  classifyCard,
  expiryYears,
  groupCardNumber,
  MAX_CARD_DIGITS,
  MIN_CARD_DIGITS,
} from "./card-brand";

export type CardDraft = {
  /** Grouped for display; `cardDigits` is what goes on the wire. */
  number: string;
  /** "" or "01".."12" — `Number()` gives the `expires_month` the API wants. */
  month: string;
  /** "" or a four-digit year, as `expires_year`. */
  year: string;
  holder: string;
};

export const EMPTY_CARD_DRAFT: CardDraft = { number: "", month: "", year: "", holder: "" };

/** True once the number is long enough to be worth sending. */
export function cardDraftIsValid(draft: CardDraft): boolean {
  const digits = cardDigits(draft.number);
  return digits.length >= MIN_CARD_DIGITS && digits.length <= MAX_CARD_DIGITS;
}

export function CardEntry({
  value,
  onChange,
  numberHint,
}: {
  value: CardDraft;
  onChange: (next: CardDraft) => void;
  /** The same promise in both places, worded for the screen it is on. */
  numberHint: string;
}) {
  const years = expiryYears();
  const digits = cardDigits(value.number);
  const { brand } = classifyCard(value.number);

  function patch(part: Partial<CardDraft>) {
    onChange({ ...value, ...part });
  }

  return (
    <div className="space-y-5">
      <CardPreview
        number={value.number}
        holder={value.holder}
        month={value.month}
        year={value.year}
      />

      <div className="space-y-4">
        <Field label="Karta raqami" hint={numberHint}>
          <Input
            value={value.number}
            onChange={(event) => patch({ number: groupCardNumber(event.target.value) })}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="8600 1234 5678 9012"
            maxLength={MAX_CARD_DIGITS + 4}
            required
          />
        </Field>

        {/* The preview is decoration to a screen reader, so the brand it found
            is announced here instead — otherwise the only feedback that the
            number was understood is invisible. */}
        <p aria-live="polite" className="sr-only">
          {digits.length >= 4 ? `Karta turi: ${BRAND_LABEL[brand]}` : ""}
        </p>

        <Field label="Karta egasi" hint="Kartada yozilganidek.">
          <Input
            value={value.holder}
            onChange={(event) => patch({ holder: event.target.value })}
            autoComplete="cc-name"
            maxLength={120}
            placeholder="ALISHER KARIMOV"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amal qilish oyi">
            <Select
              value={value.month}
              onChange={(event) => patch({ month: event.target.value })}
              autoComplete="cc-exp-month"
              className="min-h-11"
            >
              <option value="">Tanlang</option>
              {EXPIRY_MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amal qilish yili">
            <Select
              value={value.year}
              onChange={(event) => patch({ year: event.target.value })}
              autoComplete="cc-exp-year"
              className="min-h-11"
            >
              <option value="">Tanlang</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}
