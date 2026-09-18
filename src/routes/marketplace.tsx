import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Page, PageTitle, EmptyState } from "@/components/motora/Page";
import { ProductCard } from "@/components/motora/ProductCard";
import { categories, products, type CategoryId } from "@/data/demo";
import { useLang, useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Search = {
  q?: string;
  category?: CategoryId;
  sort?: "popular" | "cheap" | "expensive" | "rating";
  fit?: boolean;
};

export const Route = createFileRoute("/marketplace")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    category: categories.some((c) => c.id === search.category)
      ? (search.category as CategoryId)
      : undefined,
    sort: ["popular", "cheap", "expensive", "rating"].includes(String(search.sort))
      ? (search.sort as Search["sort"])
      : undefined,
    fit: search.fit === true || search.fit === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Marketplace — MOTORA" },
      {
        name: "description",
        content: "Ehtiyot qismlarni kategoriya, narx va moslik bo'yicha filtrlang.",
      },
      { property: "og:title", content: "Marketplace — MOTORA" },
      { property: "og:description", content: "Toshkentdagi sotuvchilardan mos detallar." },
    ],
  }),
  component: Marketplace,
});

function Marketplace() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate({ from: "/marketplace" });
  const search = Route.useSearch();
  const { activeVehicle } = useStore();

  const setSearch = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const list = useMemo(() => {
    let out = products.slice();
    if (search.q) {
      const q = search.q.toLowerCase();
      out = out.filter((p) =>
        [p.nameUz, p.nameRu, p.brand, p.oem].some((v) => v.toLowerCase().includes(q)),
      );
    }
    if (search.category) out = out.filter((p) => p.category === search.category);
    if (search.fit && activeVehicle)
      out = out.filter((p) => p.fitsModels.includes(activeVehicle.model));

    switch (search.sort) {
      case "cheap":
        out.sort((a, b) => a.price - b.price);
        break;
      case "expensive":
        out.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        out.sort((a, b) => b.rating - a.rating);
        break;
      default:
        out.sort((a, b) => b.sold - a.sold);
    }
    return out;
  }, [search, activeVehicle]);

  const sorts = [
    { id: "popular", label: t("market.sortPopular") },
    { id: "cheap", label: t("market.sortCheap") },
    { id: "expensive", label: t("market.sortExpensive") },
    { id: "rating", label: t("market.sortRating") },
  ] as const;

  return (
    <Page>
      <PageTitle
        title={t("market.title")}
        subtitle={`${list.length} ${t("market.results")}${search.q ? ` · "${search.q}"` : ""}`}
      />

      <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setSearch({ category: undefined })}
          className={cn(
            "whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
            !search.category
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card",
          )}
        >
          {t("common.all")}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSearch({ category: search.category === c.id ? undefined : c.id })}
            className={cn(
              "whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
              search.category === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            {lang === "uz" ? c.uz : c.ru}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {activeVehicle && (
          <button
            type="button"
            onClick={() => setSearch({ fit: search.fit ? undefined : true })}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
              search.fit
                ? "border-accent-electric bg-accent-electric text-accent-electric-foreground"
                : "border-border bg-card",
            )}
          >
            {t("fit.filter")}
          </button>
        )}
        <span className="type-caption ml-auto">{t("market.sort")}:</span>
        {sorts.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSearch({ sort: s.id })}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
              (search.sort ?? "popular") === s.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title={t("market.nothing")} subtitle={t("cart.emptySub")} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </Page>
  );
}
