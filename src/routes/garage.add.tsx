import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Page, PageTitle } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState } from "@/components/avtoqism/States";
import { ApiError } from "@/lib/api/client";
import { useIsAuthenticated } from "@/lib/query/session";
import { useT } from "@/lib/i18n";
import {
  useAddVehicle,
  useVehicleBrands,
  useVehicleModels,
  useVehicleVariants,
  useVehicleYears,
} from "@/lib/query/garage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/garage/add")({
  head: () => ({
    meta: [
      { title: "Avtomobil qo'shish — AVTOQISM" },
      {
        name: "description",
        content: "Marka, model, yil va dvigatelni tanlab garajga qo'shing.",
      },
    ],
  }),
  component: AddVehicle,
});

const STEPS = ["add.brand", "add.model", "add.year", "add.variant", "add.details"] as const;

function Option({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "border px-4 py-3.5 text-left text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-border-strong",
      )}
    >
      {label}
      {hint && (
        <span
          className={cn(
            "block text-xs font-normal",
            active ? "opacity-80" : "text-muted-foreground",
          )}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

function AddVehicle() {
  const t = useT();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [mileage, setMileage] = useState("");
  const [vin, setVin] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const brands = useVehicleBrands();
  const models = useVehicleModels(brandSlug);
  const years = useVehicleYears(modelId);
  const variants = useVehicleVariants(modelId, year);
  const addVehicle = useAddVehicle();
  const signedIn = useIsAuthenticated();

  if (!signedIn) return <SignInRequired />;

  const submit = () => {
    if (!variantId || !year) return;
    setFieldError(null);
    addVehicle.mutate(
      {
        variant_id: variantId,
        year,
        plate_number: plate.trim() || null,
        color: color.trim() || null,
        vin: vin.trim() ? vin.trim().toUpperCase() : null,
        mileage_km: mileage ? Number(mileage) : null,
        make_primary: true,
      },
      {
        onSuccess: () => {
          toast.success(t("garage.ready"));
          void navigate({ to: "/garage" });
        },
        onError: (error) => {
          // A field-level rejection (bad VIN, year out of range) belongs next to
          // the form, not in a toast that disappears.
          if (error instanceof ApiError && error.status === 422) setFieldError(error.message);
          else toast.error((error as Error).message);
        },
      },
    );
  };

  return (
    <Page className="max-w-3xl">
      <PageTitle
        eyebrow={`${t("add.step")} ${step + 1} / ${STEPS.length}`}
        title={t("garage.add")}
      />

      {/* progress */}
      <ol className="mb-10 flex items-center gap-2" aria-label="Qadamlar">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center text-xs font-bold",
                i < step
                  ? "bg-success text-success-foreground"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            {i < STEPS.length - 1 && (
              <span className={cn("h-px flex-1", i < step ? "bg-success" : "bg-border")} />
            )}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Section title={t("add.brand")} query={brands}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(brands.data ?? []).map((b) => (
              <Option
                key={b.id}
                label={b.name}
                active={brandSlug === b.slug}
                onClick={() => {
                  setBrandSlug(b.slug);
                  setModelId(null);
                  setYear(null);
                  setVariantId(null);
                  setStep(1);
                }}
              />
            ))}
          </div>
        </Section>
      )}

      {step === 1 && (
        <Section title={t("add.model")} query={models}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(models.data ?? []).map((m) => (
              <Option
                key={m.id}
                label={m.name}
                active={modelId === m.id}
                onClick={() => {
                  setModelId(m.id);
                  setYear(null);
                  setVariantId(null);
                  setStep(2);
                }}
              />
            ))}
          </div>
        </Section>
      )}

      {step === 2 && (
        <Section title={t("add.year")} query={years}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {(years.data ?? []).map((y) => (
              <Option
                key={y}
                label={String(y)}
                active={year === y}
                onClick={() => {
                  setYear(y);
                  setVariantId(null);
                  setStep(3);
                }}
              />
            ))}
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section title={t("add.variant")} query={variants}>
          {(variants.data ?? []).length === 0 ? (
            <p className="type-caption">
              Bu yil uchun variant topilmadi. Boshqa yilni tanlab ko'ring.
            </p>
          ) : (
            <div className="grid gap-3">
              {(variants.data ?? []).map((v) => (
                <Option
                  key={v.id}
                  label={`${v.engine?.displacement_l ?? "—"} · ${
                    v.transmission === "AUTOMATIC" ? "Avtomat" : "Mexanika"
                  }`}
                  hint={`${v.display_name}${v.trim ? ` · ${v.trim}` : ""}`}
                  active={variantId === v.id}
                  onClick={() => {
                    setVariantId(v.id);
                    setStep(4);
                  }}
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {step === 4 && (
        <div>
          <h2 className="type-h3 mb-6">
            {t("add.details")}{" "}
            <span className="type-caption font-normal">({t("common.optional")})</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text
              label={t("garage.plate")}
              value={plate}
              onChange={setPlate}
              placeholder="01 A 777 VA"
            />
            <Text
              label={t("garage.color")}
              value={color}
              onChange={setColor}
              placeholder="Oq metallik"
            />
            <Text
              label={t("garage.mileage")}
              value={mileage}
              onChange={(v) => setMileage(v.replace(/\D/g, ""))}
              placeholder="32480"
              inputMode="numeric"
            />
            <Text
              label={t("add.vin")}
              value={vin}
              onChange={(v) => setVin(v.toUpperCase())}
              placeholder="XWB3L32E9PA170472"
              maxLength={17}
            />
          </div>

          {fieldError && (
            <p
              role="alert"
              className="mt-5 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive"
            >
              {fieldError}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={addVehicle.isPending}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
          >
            {addVehicle.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("add.finish")}
          </button>
        </div>
      )}

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {t("common.back")}
        </button>
      )}
    </Page>
  );
}

function Section({
  title,
  query,
  children,
}: {
  title: string;
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="type-h3 mb-6">{title}</h2>
      {query.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse bg-muted" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      ) : (
        children
      )}
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric";
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="type-label text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className="mt-2 h-12 w-full border border-input bg-surface px-3 text-sm outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}
