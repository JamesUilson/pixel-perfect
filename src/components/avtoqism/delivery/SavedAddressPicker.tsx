/**
 * The addresses the buyer already saved, as cards they pick from.
 *
 * A buyer orders parts for the same car to the same garage over and over, so
 * the default one is preselected and the whole address section collapses to a
 * single tap. "Yangi manzil" is the last card rather than a link, so the choice
 * reads as one set.
 */
import { Check, MapPin, Pencil, Plus, Star } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import type { AddressOut } from "@/lib/query/addresses";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseCoordinate } from "./address";

/** `null` is the "yangi manzil" card. */
export type SavedSelection = string | null;

export function SavedAddressPicker({
  addresses,
  selectedId,
  onSelect,
  onEdit,
  isPending,
  error,
  onRetry,
}: {
  addresses: AddressOut[];
  selectedId: SavedSelection;
  onSelect: (id: SavedSelection) => void;
  /** Copies a saved address into the new-address form for a one-off tweak. */
  onEdit?: ((address: AddressOut) => void) | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <LineSkeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    // A failing address book must never block an order: the new-address form is
    // still right there, so this is a compact notice, not a dead end.
    return (
      <div className="space-y-3">
        <ErrorState error={error} onRetry={onRetry} compact />
        <p className="type-caption">Manzilni quyida qo'lda kiritishingiz mumkin.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {addresses.map((address) => {
        const selected = selectedId === address.id;
        const hasPin =
          parseCoordinate(address.lat) !== null && parseCoordinate(address.lng) !== null;
        return (
          <div
            key={address.id}
            className={cn(
              "relative border p-4 transition-colors",
              selected ? "border-primary bg-primary/5" : "border-border hover:border-border-strong",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(address.id)}
              aria-pressed={selected}
              className="block w-full text-left"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {address.label ?? address.district}
                    </span>
                    {address.is_default && (
                      <span className="inline-flex items-center gap-1 bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                        <Star className="size-3" /> Asosiy
                      </span>
                    )}
                  </span>
                  <span className="type-caption mt-1 block">{address.line}</span>
                  <span className="type-caption mt-1 block">
                    {address.recipient_name} · {formatPhone(address.phone) || address.phone}
                  </span>
                  {hasPin && (
                    <span className="type-caption mt-1 inline-flex items-center gap-1 text-success">
                      <MapPin className="size-3" /> Xarita nuqtasi bor
                    </span>
                  )}
                </span>
                {selected && <Check className="size-5 shrink-0 text-primary" />}
              </span>
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(address)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                <Pencil className="size-3.5" /> Nusxalab tahrirlash
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selectedId === null}
        className={cn(
          "flex min-h-28 flex-col items-center justify-center gap-2 border border-dashed p-4 text-sm font-semibold transition-colors",
          selectedId === null
            ? "border-primary bg-primary/5 text-primary"
            : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
        )}
      >
        <Plus className="size-5" />
        Yangi manzil
      </button>
    </div>
  );
}
