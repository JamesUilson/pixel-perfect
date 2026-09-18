import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Page, PageTitle } from "@/components/motora/Page";
import { brands, engines, transmissions } from "@/data/demo";
import { useLang, useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/garage/add")({
  head: () => ({
    meta: [
      { title: "Mashina qo'shish — MOTORA" },
      { name: "description", content: "Marka, model, yil va dvigatelni tanlab garajga qo'shing." },
      { property: "og:title", content: "Mashina qo'shish — MOTORA" },
      { property: "og:description", content: "To'rt qadamda mashinangizni garajga qo'shing." },
    ],
  }),
  component: AddVehicle,
});

function Option({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-4 py-3 text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-border-strong",
      )}
    >
      {label}
    </button>
  );
}

function AddVehicle() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const { addVehicle } = useStore();

  const [step, setStep] = useState(0);
  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [transmission, setTransmission] = useState<string | null>(null);
  const [vin, setVin] = useState("");

  const brandData = brands.find((b) => b.name === brand);
  const modelData = brandData?.models.find((m) => m.name === model);

  const steps = [t("add.brand"), t("add.model"), t("add.year"), t("add.engine"), t("add.confirm")];

  const canNext = [!!brand, !!model, !!year, !!engine && !!transmission, true][step];

  const submit = () => {
    if (!brand || !model || !year || !engine || !transmission) return;
    addVehicle({ brand, model, year, engine, transmission, vin: vin || undefined });
    toast.success(t("garage.ready"), { description: `${brand} ${model} ${year}` });
    navigate({ to: "/garage" });
  };

  return (
    <Page className="max-w-2xl">
      <PageTitle title={t("garage.add")} subtitle={`${t("add.step")} ${step + 1} / 5`} />

      <div className="mb-6 flex gap-1.5">
        {steps.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i <= step ? "bg-accent-electric" : "bg-secondary",
            )}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="type-h2 mb-4">{steps[step]}</h2>

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {brands.map((b) => (
              <Option
                key={b.name}
                label={b.name}
                active={brand === b.name}
                onClick={() => {
                  setBrand(b.name);
                  setModel(null);
                  setYear(null);
                }}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {brandData?.models.map((m) => (
              <Option
                key={m.name}
                label={m.name}
                active={model === m.name}
                onClick={() => {
                  setModel(m.name);
                  setYear(null);
                }}
              />
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {modelData?.years.map((y) => (
              <Option
                key={y}
                label={String(y)}
                active={year === y}
                onClick={() => setYear(y)}
              />
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <p className="type-label mb-2 text-muted-foreground">{t("add.engine")}</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {engines.map((e) => (
                  <Option
                    key={e}
                    label={e}
                    active={engine === e}
                    onClick={() => setEngine(e)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="type-label mb-2 text-muted-foreground">{t("add.transmission")}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {transmissions.map((tr) => {
                  const label = lang === "uz" ? tr.uz : tr.ru;
                  return (
                    <Option
                      key={tr.uz}
                      label={label}
                      active={transmission === tr.uz}
                      onClick={() => setTransmission(tr.uz)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <dl className="divide-y divide-border rounded-lg border border-border">
              {[
                [t("add.brand"), brand],
                [t("add.model"), model],
                [t("add.year"), year],
                [t("add.engine"), engine],
                [t("add.transmission"), transmission],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <label className="type-label mb-2 block text-muted-foreground">{t("add.vin")}</label>
              <input
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                maxLength={17}
                placeholder="XW8ZZZ..."
                className="h-11 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-accent-electric"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => (step === 0 ? navigate({ to: "/garage" }) : setStep((s) => s - 1))}
          className="rounded-md border border-border px-5 py-3 text-sm font-semibold"
        >
          {t("common.back")}
        </button>
        {step < 4 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {t("common.next")}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-accent-electric px-5 py-3 text-sm font-semibold text-accent-electric-foreground"
          >
            <Check className="size-4" />
            {t("add.finish")}
          </button>
        )}
      </div>
    </Page>
  );
}
