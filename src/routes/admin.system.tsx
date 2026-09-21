/**
 * Tizim — is the platform healthy, what happened, and can I get the data out?
 *
 * The order is the order of the questions. Health first, because "is it up and
 * is the schema the one the code expects" is what gets asked before anything
 * else. Then the ledger integrity check, repeated here from the finance screen
 * because this is the page someone opens when they suspect something is wrong
 * and the answer should not require knowing which tab it lives on. Then the
 * logs — what the API actually did, and what changed in the data. Then the
 * counts, and finally every Excel export in one place: if the panel ever fails,
 * the numbers can still leave the building.
 */
import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { AuditLogPanel } from "@/components/avtoqism/admin/AuditLogPanel";
import { LogPurgeCard } from "@/components/avtoqism/admin/LogPurgeCard";
import { RequestLogPanel } from "@/components/avtoqism/admin/RequestLogPanel";
import { SystemHealthPanel } from "@/components/avtoqism/admin/SystemHealthPanel";
import { num } from "@/components/avtoqism/panel/Charts";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import { Cell, DataTable, ExportButton, Row } from "@/components/avtoqism/panel/Widgets";
import { formatSom, groupDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import {
  useAdminCampaigns,
  useAdminSellers,
  useLedgerIntegrity,
  usePlatformInventory,
  usePlatformOverview,
} from "@/lib/query/admin";

export const Route = createFileRoute("/admin/system")({
  head: () => ({
    meta: [{ title: "Tizim — AVTOQISM" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminSystem,
});

const EXPORTS: { path: string; label: string; hint: string }[] = [
  { path: "/export/admin/all", label: "Hammasi", hint: "barcha varaqlar bitta faylda" },
  { path: "/export/admin/revenue", label: "Daromad", hint: "kunlik aylanma va platforma ulushi" },
  { path: "/export/admin/sellers", label: "Sotuvchilar", hint: "do'konlar va ularning savdosi" },
  { path: "/export/admin/orders", label: "Buyurtmalar", hint: "to'liq buyurtmalar reyestri" },
  { path: "/export/admin/ledger", label: "Hisob daftari", hint: "har bir moliyaviy yozuv" },
  { path: "/export/admin/payouts", label: "To'lovlar", hint: "sotuvchilarga chiqqan pul" },
  { path: "/export/admin/campaigns", label: "Kampaniyalar", hint: "reklama va uning natijasi" },
];

function AdminSystem() {
  const { lang } = useLang();
  return (
    <div className="space-y-6">
      <SystemHealthPanel lang={lang} />
      <IntegrityCheck />
      <RequestLogPanel lang={lang} />
      <AuditLogPanel lang={lang} />
      <LogPurgeCard />
      <CountsSection />
      <InventorySection />
      <ExportsSection />
    </div>
  );
}

/* --- integrity ------------------------------------------------------------------- */
function IntegrityCheck() {
  const integrity = useLedgerIntegrity();

  if (integrity.isPending) {
    return (
      <section className="border border-border bg-card p-5">
        <LineSkeleton className="mb-3 h-4 w-48" />
        <LineSkeleton className="h-3 w-full max-w-xl" />
      </section>
    );
  }

  if (integrity.isError) {
    return <ErrorState error={integrity.error} onRetry={() => void integrity.refetch()} />;
  }

  if (integrity.data.balanced) {
    return (
      <section className="flex items-start gap-3 border border-success/40 bg-success-soft px-5 py-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-success">Hisob daftari muvozanatda</p>
          <p className="type-caption mt-1 max-w-3xl">
            Har bir yozuvlar guruhining yig'indisi nolga teng. Pul yo'qdan paydo bo'lmagan va
            yo'qolmagan — platformaning kitoblari to'g'ri.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section role="alert" className="border-2 border-destructive bg-destructive/8 px-5 py-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="type-h3 text-destructive">Hisob daftari muvozanatda emas</h3>
          <p className="type-caption mt-1 max-w-3xl">
            {integrity.data.groups.length} ta guruhning yig'indisi nolga teng emas. Bu jiddiy
            nosozlik: to'lovlarni to'xtating va texnik jamoaga darhol xabar bering.
          </p>
          <div className="mt-4 border border-destructive/40 bg-card">
            <DataTable head={["Guruh", "Farq"]}>
              {integrity.data.groups.map((group) => (
                <Row key={group.group_id}>
                  <Cell className="whitespace-nowrap font-mono text-xs">{group.group_id}</Cell>
                  <Cell numeric className="whitespace-nowrap text-destructive">
                    {formatSom(num(group.difference))}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- counts ----------------------------------------------------------------------- */
const COUNTS_SUBTITLE = "Do'konlar, foydalanuvchilar va reklama kampaniyalari soni.";

function CountsSection() {
  const overview = usePlatformOverview(30);
  const sellers = useAdminSellers();
  const campaigns = useAdminCampaigns();

  const sellerCounts = useMemo(() => {
    const list = sellers.data ?? [];
    return {
      total: list.length,
      active: list.filter((seller) => seller.status === "ACTIVE").length,
      pending: list.filter((seller) => seller.status === "PENDING").length,
      blocked: list.filter(
        (seller) => seller.status === "SUSPENDED" || seller.status === "REJECTED",
      ).length,
    };
  }, [sellers.data]);

  const campaignCounts = useMemo(() => {
    const list = campaigns.data ?? [];
    return {
      total: list.length,
      active: list.filter((campaign) => campaign.status === "ACTIVE").length,
      waiting: list.filter((campaign) => campaign.status === "PENDING_REVIEW").length,
    };
  }, [campaigns.data]);

  // One failure is enough to make the whole row misleading, so the first one
  // wins and its own retry is the one offered.
  const failure = overview.isError
    ? { error: overview.error, retry: () => void overview.refetch() }
    : sellers.isError
      ? { error: sellers.error, retry: () => void sellers.refetch() }
      : campaigns.isError
        ? { error: campaigns.error, retry: () => void campaigns.refetch() }
        : null;

  if (failure) {
    return (
      <PanelSection title="Platforma hajmi" subtitle={COUNTS_SUBTITLE}>
        <div className="p-5">
          <ErrorState error={failure.error} onRetry={failure.retry} compact />
        </div>
      </PanelSection>
    );
  }

  const platform = overview.data;
  if (!platform || sellers.isPending || campaigns.isPending) {
    return (
      <PanelSection title="Platforma hajmi" subtitle={COUNTS_SUBTITLE}>
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="bg-card p-5">
              <LineSkeleton className="mb-4 h-3 w-24" />
              <LineSkeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Platforma hajmi" subtitle={COUNTS_SUBTITLE}>
      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
        <Figure
          label="Do'konlar"
          value={groupDigits(sellerCounts.total)}
          lines={[
            `${groupDigits(sellerCounts.active)} faol`,
            `${groupDigits(sellerCounts.pending)} tasdiqlanmoqda`,
            `${groupDigits(sellerCounts.blocked)} to'xtatilgan yoki rad etilgan`,
          ]}
        />
        <Figure
          label="Foydalanuvchilar"
          value={groupDigits(platform.users_total)}
          lines={[`oxirgi 30 kunda ${groupDigits(platform.users_new)} ta yangi`]}
        />
        <Figure
          label="Kampaniyalar"
          value={groupDigits(campaignCounts.total)}
          lines={[
            `${groupDigits(campaignCounts.active)} faol`,
            `${groupDigits(campaignCounts.waiting)} tekshiruvda`,
          ]}
        />
      </div>
    </PanelSection>
  );
}

function Figure({ label, value, lines }: { label: string; value: string; lines: string[] }) {
  return (
    <div className="bg-card p-5">
      <p className="type-label text-muted-foreground">{label}</p>
      <p className="font-display mt-3 text-[1.5rem] font-semibold leading-none tracking-tight">
        {value}
      </p>
      <ul className="mt-3 space-y-1">
        {lines.map((line) => (
          <li key={line} className="type-caption">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --- inventory ---------------------------------------------------------------------- */
function InventorySection() {
  const inventory = usePlatformInventory();

  return (
    <PanelSection title="Ombor holati" subtitle="Barcha do'konlarning zaxirasi bir joyda.">
      {inventory.isPending ? (
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="bg-card p-5">
              <LineSkeleton className="mb-4 h-3 w-24" />
              <LineSkeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
      ) : inventory.isError ? (
        <div className="p-5">
          <ErrorState error={inventory.error} onRetry={() => void inventory.refetch()} compact />
        </div>
      ) : (
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          <Figure
            label="Zaxiradagi birliklar"
            value={groupDigits(inventory.data.units)}
            lines={[`${groupDigits(inventory.data.warehouses)} ta omborda`]}
          />
          <Figure
            label="Band qilingan"
            value={groupDigits(inventory.data.reserved)}
            lines={["ochilmagan buyurtmalar uchun"]}
          />
          <Figure
            label="Zaxira qiymati"
            value={formatSom(num(inventory.data.retail_value))}
            lines={["chakana narxlarda"]}
          />
          <Figure
            label="Qoldiqsiz takliflar"
            value={groupDigits(inventory.data.out_of_stock_offers)}
            lines={["katalogda bor, omborda yo'q"]}
          />
        </div>
      )}
    </PanelSection>
  );
}

/* --- exports -------------------------------------------------------------------------- */
function ExportsSection() {
  return (
    <PanelSection
      title="Excel hisobotlari"
      subtitle="Har bir hisobot serverda yig'iladi va tayyor .xlsx fayl sifatida yuklanadi."
    >
      <ul className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
        {EXPORTS.map((report) => (
          <li key={report.path} className="flex flex-col gap-3 bg-card p-5">
            <div>
              <p className="text-sm font-semibold">{report.label}</p>
              <p className="type-caption mt-1">{report.hint}</p>
            </div>
            <span className="mt-auto flex">
              <ExportButton path={report.path} label={`${report.label} — Excel`} />
            </span>
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}
