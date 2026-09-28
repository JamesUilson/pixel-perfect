/**
 * The card being typed, drawn.
 *
 * Why it earns its space: adding a card is the one form on this site where the
 * source of truth is a physical object in the person's other hand. A preview
 * that groups the digits the way the card groups them, and puts the holder and
 * the expiry where the card puts them, turns "did I type that right?" from a
 * re-read of sixteen digits into a glance.
 *
 * Two rules it is built to:
 *
 *   - **No payment network's mark is reproduced.** The chip and the contactless
 *     arcs are generic industry symbols drawn here as inline SVG; the brand is
 *     named in plain text. Nothing is fetched, and nothing imitates a Visa,
 *     Mastercard, Uzcard or Humo logo.
 *   - **It belongs to this product.** Every colour is an AVTOQISM token, so the
 *     preview reads as part of the app rather than as a bank's advertising.
 *
 * It renders whatever the number field currently holds and nothing more: it
 * keeps no state, and it is unmounted the moment the form advances to the code
 * step, so no number survives the request that clears it.
 */
import { BRAND_LABEL, cardDigits, classifyCard } from "./card-brand";
import { cn } from "@/lib/utils";

/** The frame a card is shown in even before it has been typed. */
const PLACEHOLDER_LENGTH = 16;
const DOT = "•";

function previewGroups(raw: string): string[] {
  const digits = cardDigits(raw);
  const filled = digits.padEnd(Math.max(PLACEHOLDER_LENGTH, digits.length), DOT);
  return filled.match(/.{1,4}/g) ?? [];
}

/** A generic EMV contact plate. Every card has one; no scheme owns the shape. */
function ChipGlyph() {
  return (
    <svg viewBox="0 0 32 24" className="h-6 w-8" fill="none" aria-hidden focusable="false">
      <rect
        x="0.9"
        y="0.9"
        width="30.2"
        height="22.2"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M11 1v22M21 1v22M1 8h10M21 8h10M1 16h10M21 16h10"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** The contactless symbol — an industry mark, not a brand's. */
function ContactlessGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden focusable="false">
      <path
        d="M4.2 4.4a5 5 0 0 1 0 7.2M7 5.9a2.8 2.8 0 0 1 0 4.2M9.8 3.2a7.6 7.6 0 0 1 0 9.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CardPreview({
  number,
  holder,
  month,
  year,
  className,
}: {
  number: string;
  holder: string;
  /** The select values, as strings: "" while nothing is chosen. */
  month: string;
  year: string;
  className?: string | undefined;
}) {
  const { brand, bank } = classifyCard(number);
  const groups = previewGroups(number);
  const mm = month === "" ? "MM" : month;
  const yy = year === "" ? "YY" : year.slice(-2);

  return (
    <div
      /* The fields below are the accessible version of everything shown here,
         and a screen reader should not hear the number twice. */
      aria-hidden
      className={cn(
        "flex aspect-[1.586] w-full max-w-sm flex-col justify-between border border-border bg-card p-5 shadow-raise",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-primary">
          <ChipGlyph />
          <ContactlessGlyph />
        </span>
        <span className="text-right">
          <span className="type-label block text-foreground">{BRAND_LABEL[brand]}</span>
          <span className="type-caption block">{bank}</span>
        </span>
      </div>

      <p className="flex flex-wrap gap-x-3 font-mono text-base font-semibold tabular-nums tracking-[0.08em] sm:text-lg">
        {groups.map((group, index) => (
          <span key={index}>{group}</span>
        ))}
      </p>

      <div className="flex items-end justify-between gap-4">
        <span className="min-w-0">
          <span className="type-label block text-muted-foreground">Karta egasi</span>
          <span className="block truncate text-sm font-semibold uppercase">
            {holder.trim() === "" ? "ISM FAMILIYA" : holder}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="type-label block text-muted-foreground">Amal qilish</span>
          <span className="block text-sm font-semibold tabular-nums">
            {mm}/{yy}
          </span>
        </span>
      </div>
    </div>
  );
}
