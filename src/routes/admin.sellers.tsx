/**
 * Sotuvchilar — every store on the platform, with what it actually sells.
 *
 * The screen has two halves. The review queue on top is where a store's right
 * to sell is granted, refused, taken away or given back; it carries the papers
 * with the row so a decision does not require opening four other screens.
 *
 * The registry below answers "who is here"; it does not answer "who matters".
 * So the sales figures for the chosen period are joined onto each row by seller
 * id, and a store with no sales in the period shows a dash rather than being
 * hidden — a registered, silent shop is exactly the thing an admin wants to
 * notice.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { StoreReviewQueue } from "@/components/avtoqism/admin/StoreReviewQueue";
import { num } from "@/components/avtoqism/panel/Charts";
import { PanelSection, PanelToolbar } from "@/components/avtoqism/panel/PanelShell";
import {
  Cell,
  DataTable,
  ExportButton,
  Input,
  Pill,
  RangePicker,
  Row,
} from "@/components/avtoqism/panel/Widgets";
import type { TopSeller } from "@/lib/api/types";
import { formatSom, groupDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useAdminSellers, useTopSellers } from "@/lib/query/admin";

export const Route = createFileRoute("/admin/sellers")({
  head: () => ({
    meta: [{ title: "Sotuvchilar — AVTOQISM" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminSellers,
});

const STATUS_UZ: Record<
  string,
  { label: string; tone: "neutral" | "good" | "warning" | "critical" | "info" }
> = {
  ACTIVE: { label: "Faol", tone: "good" },
  PENDING: { label: "Tasdiqlanmoqda", tone: "warning" },
  SUSPENDED: { label: "To'xtatilgan", tone: "critical" },
  REJECTED: { label: "Rad etildi", tone: "critical" },
};

const VERIFICATION_UZ: Record<string, string> = {
  BASIC: "Oddiy",
  BUSINESS_VERIFIED: "Biznes tasdiqlangan",
  TRUSTED_SELLER: "Ishonchli sotuvchi",
};

function AdminSellers() {
  const { lang } = useLang();
  const [days, setDays] = useState(30);
  const [query, setQuery] = useState("");

  const sellers = useAdminSellers();
  const top = useTopSellers(days, 50);

  const salesById = useMemo(() => {
    const map = new Map<string, TopSeller>();
    for (const row of top.data ?? []) map.set(row.seller_id, row);
    return map;
  }, [top.data]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = sellers.data ?? [];
    if (needle === "") return list;
    return list.filter((seller) => seller.store_name.toLowerCase().includes(needle));
  }, [sellers.data, query]);

  return (
    <div className="space-y-6">
      <StoreReviewQueue lang={lang} />

      <PanelToolbar>
        <label className="relative flex-1 sm:max-w-xs">
          <span className="sr-only">Do'kon nomi bo'yicha qidirish</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Do'kon nomi"
            className="pl-9"
          />
        </label>
        <RangePicker value={days} onChange={setDays} />
        <span className="ml-auto">
          <ExportButton path="/export/admin/sellers" />
        </span>
      </PanelToolbar>

      <PanelSection
        title="Do'konlar"
        subtitle="Savdo ustunlari tanlangan davrga tegishli; qolganlari do'konning umumiy holati."
      >
        <p className="border-b border-border bg-muted/40 px-5 py-3 text-sm text-muted-foreground">
          Bu jadval — reyestr: u kim borligini va qancha sotganini ko'rsatadi. Tasdiqlash,
          to'xtatish va tiklash yuqoridagi «Do'konlarni ko'rib chiqish» bo'limida.
        </p>

        {sellers.isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }, (_, index) => (
              <LineSkeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : sellers.isError ? (
          <div className="p-5">
            <ErrorState error={sellers.error} onRetry={() => void sellers.refetch()} compact />
          </div>
        ) : (
          <DataTable
            head={[
              "Do'kon",
              "Hudud",
              "Holat",
              "Tasdiq darajasi",
              "Reyting",
              "Sotilgan",
              "Buyurtmalar",
              "Savdo",
              "Komissiya",
            ]}
            empty={
              <p className="type-caption">
                {query.trim() === ""
                  ? "Hali birorta do'kon ro'yxatdan o'tmagan."
                  : "Bu nom bo'yicha do'kon topilmadi."}
              </p>
            }
          >
            {rows.map((seller) => {
              const status = STATUS_UZ[seller.status] ?? {
                label: seller.status,
                tone: "neutral" as const,
              };
              const sales = salesById.get(seller.id);
              return (
                <Row key={seller.id}>
                  <Cell>
                    <span className="font-semibold">{seller.store_name}</span>
                    <span className="type-caption block">{seller.slug}</span>
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    {seller.region}
                    <span className="type-caption block">{seller.district}</span>
                  </Cell>
                  <Cell>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    {VERIFICATION_UZ[seller.verification_level] ?? seller.verification_level}
                  </Cell>
                  <Cell numeric className="whitespace-nowrap">
                    {seller.rating_count === 0 ? (
                      "—"
                    ) : (
                      <>
                        {num(seller.rating_avg).toFixed(1)}
                        <span className="type-caption ml-1">
                          ({groupDigits(seller.rating_count)})
                        </span>
                      </>
                    )}
                  </Cell>
                  <Cell numeric>{groupDigits(seller.sold_count)}</Cell>
                  <Cell numeric className="whitespace-nowrap">
                    {sales ? groupDigits(sales.orders) : "—"}
                  </Cell>
                  <Cell numeric className="whitespace-nowrap">
                    {sales ? formatSom(num(sales.sales)) : "—"}
                  </Cell>
                  <Cell numeric className="whitespace-nowrap">
                    {sales ? formatSom(num(sales.commission)) : "—"}
                  </Cell>
                </Row>
              );
            })}
          </DataTable>
        )}

        {top.isError && (
          <p className="border-t border-border px-5 py-3 text-sm text-destructive">
            Savdo raqamlarini yuklab bo'lmadi: {top.error.message}
          </p>
        )}
      </PanelSection>
    </div>
  );
}
