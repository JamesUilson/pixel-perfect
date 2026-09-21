import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { EmptyState, Page, PageTitle } from "@/components/avtoqism/Page";
import { ProductCard } from "@/components/avtoqism/ProductCard";
import { ErrorState, ProductGridSkeleton } from "@/components/avtoqism/States";
import { useLang, useT } from "@/lib/i18n";
import { useCategories, useProducts } from "@/lib/query/catalog";
import { useActiveVehicle } from "@/lib/query/garage";
import { cn } from "@/lib/utils";

const SORTS = ["relevance", "popular", "price_asc", "price_desc", "rating", "newest"] as const;
type Sort = (typeof SORTS)[number];

type Search = {
  q?: string | undefined;
  category?: string | undefined;
  sort?: Sort | undefined;
  fit?: boolean | undefined;
  in_stock?: boolean | undefined;
  page?: number | undefined;
};

export const Route = createFileRoute("/marketplace")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
    category: typeof search["category"] === "string" ? search["category"] : undefined,
    sort: SORTS.includes(search["sort"] as Sort) ? (search["sort"] as Sort) : undefined,
    fit: search["fit"] === true || search["fit"] === "true" ? true : undefined,
    in_stock: search["in_stock"] === true || search["in_stock"] === "true" ? true : undefined,
    page: Number(search["page"]) > 1 ? Number(search["page"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Katalog — AVTOQISM" },
      {
        name: "description",
        content: "Ehtiyot qismlarni kategoriya, narx va moslik bo'yicha filtrlang.",
      },
      { property: "og:title", content: "Katalog — AVTOQISM" },
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
  const { activeVehicle } = useActiveVehicle();

  const categories = useCategories();
  const products = useProducts({
    q: search.q,
    category: search.category,
    sort: search.sort ?? "relevance",
    fits_my_car: search.fit,
    in_stock: search.in_stock,
    page: search.page ?? 1,
    size: 24,
  });

  // ``prev`` is annotated rather than inferred: the router's generated search
  // type for this route is a union once other routes register their own, and
  // the inferred parameter lands as implicit any under `noImplicitAny`.
  const setSearch = (patch: Partial<Search>) =>
    void navigate({ search: (prev: Search) => ({ ...prev, ...patch, page: undefined }) });

  const sortLabels: Record<Sort, string> = {
    relevance: t("market.sortRelevance"),
    popular: t("market.sortPopular"),
    price_asc: t("market.sortCheap"),
    price_desc: t("market.sortExpensive"),
    rating: t("market.sortRating"),
    newest: t("market.sortNewest"),
  };

  const total = products.data?.total ?? 0;
  const hasFilters = Boolean(search.q || search.category || search.fit || search.in_stock);

  return (
    <Page>
      <PageTitle
        eyebrow="AVTOQISM"
        title={t("market.title")}
        subtitle={
          products.isPending
            ? t("common.loading")
            : `${total} ${t("market.results")}${search.q ? ` · «${search.q}»` : ""}`
        }
      />

      {/* category chips */}
      <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setSearch({ category: undefined })}
          className={cn(
            "whitespace-nowrap border px-4 py-2.5 text-sm font-semibold transition-colors",
            !search.category
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card hover:border-border-strong",
          )}
        >
          {t("common.all")}
        </button>
        {(categories.data ?? [])
          .filter((c) => c.product_count > 0)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                setSearch({ category: search.category === c.slug ? undefined : c.slug })
              }
              className={cn(
                "whitespace-nowrap border px-4 py-2.5 text-sm font-semibold transition-colors",
                search.category === c.slug
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:border-border-strong",
              )}
            >
              {lang === "uz" ? c.name_uz : (c.name_ru ?? c.name_uz)}
            </button>
          ))}
      </div>

      {/* filters + sort */}
      <div className="mb-8 flex flex-wrap items-center gap-2 border-y border-border py-3">
        {activeVehicle && (
          <button
            type="button"
            onClick={() => setSearch({ fit: search.fit ? undefined : true })}
            aria-pressed={Boolean(search.fit)}
            className={cn(
              "border px-3 py-2 text-sm font-semibold transition-colors",
              search.fit
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-border-strong",
            )}
          >
            {t("fit.filter")}
          </button>
        )}
        <button
          type="button"
          onClick={() => setSearch({ in_stock: search.in_stock ? undefined : true })}
          aria-pressed={Boolean(search.in_stock)}
          className={cn(
            "border px-3 py-2 text-sm font-semibold transition-colors",
            search.in_stock
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:border-border-strong",
          )}
        >
          {t("market.onlyInStock")}
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={() => void navigate({ search: {} })}
            className="px-3 py-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("market.clearFilters")}
          </button>
        )}

        <label className="type-caption ml-auto flex items-center gap-2">
          {t("market.sort")}:
          <select
            value={search.sort ?? "relevance"}
            onChange={(e) => setSearch({ sort: e.target.value as Sort })}
            className="border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {sortLabels[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {products.isPending ? (
        <ProductGridSkeleton count={12} />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      ) : products.data.items.length === 0 ? (
        <EmptyState
          title={t("market.nothing")}
          subtitle={t("market.nothingSub")}
          action={
            hasFilters ? (
              <button
                type="button"
                onClick={() => void navigate({ search: {} })}
                className="bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                {t("market.clearFilters")}
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div
            className={cn(
              "grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-8",
              products.isFetching && "opacity-60 transition-opacity",
            )}
          >
            {products.data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          {products.data.pages > 1 && (
            <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Sahifalar">
              {Array.from({ length: products.data.pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    void navigate({ search: (prev: Search) => ({ ...prev, page: n }) })
                  }
                  aria-current={n === products.data.page ? "page" : undefined}
                  className={cn(
                    "min-w-10 border px-3 py-2 text-sm font-semibold transition-colors",
                    n === products.data.page
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card hover:border-border-strong",
                  )}
                >
                  {n}
                </button>
              ))}
            </nav>
          )}
        </>
      )}
    </Page>
  );
}
