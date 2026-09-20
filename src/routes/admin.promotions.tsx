/**
 * Aksiyalar — every discount running anywhere on the marketplace.
 *
 * Read-only on purpose. A promotion belongs to the store that funded it, and
 * the platform reaching in to edit or cancel one would be spending a seller's
 * money for them. What an admin needs here is oversight: to see what is live,
 * how deep the discounts go and which codes are being used.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { num } from "@/components/avtoqism/panel/Charts";
import { PanelSection, PanelToolbar } from "@/components/avtoqism/panel/PanelShell";
import { Cell, DataTable, Input, Pill, Row } from "@/components/avtoqism/panel/Widgets";
import type { PromotionOut, SellerOut } from "@/lib/api/types";
import { formatDate, formatSom, groupDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useAdminPromotions, useAdminSellers } from "@/lib/query/admin";

export const Route = createFileRoute("/admin/promotions")({
  head: () => ({
    meta: [{ title: "Aksiyalar — AVTOQISM" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPromotions,
});

const KIND_UZ: Record<string, string> = {
  PERCENT: "Foizli chegirma",
  FIXED: "Belgilangan summa",
  FREE_DELIVERY: "Bepul yetkazish",
};

function valueLabel(promotion: PromotionOut): string {
  if (promotion.kind === "FREE_DELIVERY") return "—";
  if (promotion.kind === "PERCENT") return `${num(promotion.value)}%`;
  return formatSom(num(promotion.value));
}

/**
 * "Now" is read after mount, never during render: the server and the browser
 * would not agree on it, and a status that flips between the two is a hydration
 * mismatch. Until it is known, only the on/off flag is shown.
 */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now;
}

function statusOf(
  promotion: PromotionOut,
  now: number | null,
): { label: string; tone: "good" | "warning" | "neutral" | "info" } {
  if (!promotion.is_active) return { label: "To'xtatilgan", tone: "neutral" };
  if (now === null) return { label: "Faol", tone: "good" };
  if (now < new Date(promotion.starts_at).getTime()) {
    return { label: "Rejalashtirilgan", tone: "info" };
  }
  if (now > new Date(promotion.ends_at).getTime()) return { label: "Tugagan", tone: "neutral" };
  return { label: "Faol", tone: "good" };
}

function sellerName(sellers: SellerOut[] | undefined, id: string): string {
  return sellers?.find((seller) => seller.id === id)?.store_name ?? id.slice(0, 8);
}

function AdminPromotions() {
  const { lang } = useLang();
  const now = useNow();
  const [query, setQuery] = useState("");

  const promotions = useAdminPromotions();
  const sellers = useAdminSellers();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = promotions.data ?? [];
    if (needle === "") return list;
    return list.filter(
      (promotion) =>
        promotion.title_uz.toLowerCase().includes(needle) ||
        (promotion.code ?? "").toLowerCase().includes(needle) ||
        sellerName(sellers.data, promotion.seller_id).toLowerCase().includes(needle),
    );
  }, [promotions.data, sellers.data, query]);

  return (
    <div className="space-y-6">
      <PanelToolbar>
        <label className="relative flex-1 sm:max-w-sm">
          <span className="sr-only">Aksiya, promokod yoki do'kon bo'yicha qidirish</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Aksiya nomi, promokod yoki do'kon"
            className="pl-9"
          />
        </label>
      </PanelToolbar>

      <PanelSection
        title="Barcha aksiyalar"
        subtitle="Platformadagi har bir do'konning chegirmalari va promokodlari."
      >
        <p className="border-b border-border bg-muted/40 px-5 py-3 text-sm text-muted-foreground">
          Bu ro'yxat faqat kuzatish uchun: aksiyani do'konning o'zi yaratadi, o'zgartiradi va
          to'xtatadi — chegirma sotuvchining hisobidan beriladi.
        </p>

        {promotions.isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }, (_, index) => (
              <LineSkeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : promotions.isError ? (
          <div className="p-5">
            <ErrorState
              error={promotions.error}
              onRetry={() => void promotions.refetch()}
              compact
            />
          </div>
        ) : (
          <DataTable
            head={[
              "Nomi",
              "Do'kon",
              "Turi",
              "Qiymat",
              "Promokod",
              "Muddat",
              "Foydalanildi",
              "Holat",
            ]}
            empty={
              <p className="type-caption">
                {query.trim() === ""
                  ? "Hozircha hech bir do'kon aksiya e'lon qilmagan."
                  : "Bu so'rov bo'yicha aksiya topilmadi."}
              </p>
            }
          >
            {rows.map((promotion) => {
              const status = statusOf(promotion, now);
              return (
                <Row key={promotion.id}>
                  <Cell>
                    <span className="font-semibold">{promotion.title_uz}</span>
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    {sellerName(sellers.data, promotion.seller_id)}
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    {KIND_UZ[promotion.kind] ?? promotion.kind}
                  </Cell>
                  <Cell numeric className="whitespace-nowrap">
                    {valueLabel(promotion)}
                  </Cell>
                  <Cell className="whitespace-nowrap font-mono text-xs">
                    {promotion.code ?? "—"}
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    {formatDate(promotion.starts_at, lang)}–{formatDate(promotion.ends_at, lang)}
                  </Cell>
                  <Cell numeric className="whitespace-nowrap">
                    {groupDigits(promotion.used_count)}
                    {promotion.usage_limit == null
                      ? ""
                      : ` / ${groupDigits(promotion.usage_limit)}`}
                  </Cell>
                  <Cell>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </Cell>
                </Row>
              );
            })}
          </DataTable>
        )}
      </PanelSection>
    </div>
  );
}
