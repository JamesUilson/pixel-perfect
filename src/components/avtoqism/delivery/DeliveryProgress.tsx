/**
 * The five steps, as a progress row.
 *
 * The order status machine has nine states, most of which mean nothing to a
 * buyer; the server maps them onto five it can read — Qabul qilindi,
 * Yig'ilmoqda, Tayyor bo'ldi, Kuryerga berildi, Yetkazildi — and this only
 * draws what it is handed. A step that happened shows when; the live one shows
 * what is happening; an order that ended early shows its notice instead.
 */
import { AlertTriangle, Check, Clock } from "lucide-react";

import { formatDate, formatDateTime } from "@/lib/format";
import type { DeliveryTimeline } from "@/lib/query/commerce";
import { cn } from "@/lib/utils";
import { calendarDayIso } from "./address";
import { reached } from "./timeline";

export function DeliveryProgress({
  timeline,
  lang,
}: {
  timeline: DeliveryTimeline;
  lang: "uz" | "ru";
}) {
  const { steps, promised_date: promisedDate, promise_days: promiseDays, late, notice } = timeline;

  return (
    <section className="border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="type-h3">Yetkazib berish</h2>
          {promisedDate && (
            <p className="type-caption mt-1">
              Va'da qilingan sana:{" "}
              <span className="font-semibold text-foreground">
                {formatDate(calendarDayIso(promisedDate), lang)}
              </span>
              {promiseDays > 0 && ` · ${promiseDays} kun ichida`}
            </p>
          )}
        </div>
        {late && (
          // Plainly stated, not alarming: the parcel is still coming.
          <span className="inline-flex items-center gap-1.5 bg-warning/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-warning-foreground">
            <Clock className="size-3.5" /> Kechikmoqda
          </span>
        )}
      </div>

      {late && !notice && (
        <p className="type-caption mt-3 border border-warning/40 bg-warning/10 p-3">
          Va'da qilingan sanadan o'tdi. Buyurtma bekor qilinmagan — sotuvchi bilan bog'lanmoqdamiz.
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mt-4 inline-flex w-full items-start gap-2 border border-border-strong bg-muted p-4 text-sm font-semibold"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {notice}
        </p>
      )}

      <ol className="mt-6 sm:grid sm:grid-cols-5">
        {steps.map((step, index) => {
          const done = reached(step);
          const active = step.state === "active";
          const last = index === steps.length - 1;
          // The line leaving a step is lit only once the parcel has moved past
          // it — so the run of colour stops exactly where the order stopped.
          const nextStep = steps[index + 1];
          const litConnector =
            done && nextStep !== undefined && (reached(nextStep) || nextStep.state === "active");

          return (
            <li
              key={step.key}
              // The lit step is carried in the markup, not only in the colour:
              // a screen reader reading five stage names in a row otherwise has
              // no way to say which one the parcel is on.
              {...(active ? { "aria-current": "step" as const } : {})}
              data-state={step.state}
              className="relative flex gap-3 pb-6 last:pb-0 sm:block sm:pb-0"
            >
              <div className="relative flex w-7 shrink-0 justify-center sm:mb-3 sm:w-full">
                {!last && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      // Reaches into the row's own bottom padding, so the line
                      // meets the next dot instead of stopping short of it.
                      "absolute -bottom-6 left-1/2 top-7 w-px -translate-x-1/2",
                      "sm:bottom-auto sm:left-[calc(50%+0.875rem)] sm:top-3.5 sm:h-px sm:w-[calc(100%-1.75rem)] sm:translate-x-0",
                      litConnector ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    active && "border-primary bg-primary text-primary-foreground",
                    done && !active && "border-primary bg-primary/10 text-primary",
                    !done && !active && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done && !active ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        active ? "bg-primary-foreground" : "bg-border-strong",
                      )}
                      aria-hidden="true"
                    />
                  )}
                </span>
              </div>

              <div className="min-w-0 pb-1 sm:px-1 sm:text-center">
                <p
                  className={cn(
                    "text-sm",
                    active || done ? "font-semibold" : "font-medium text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                {step.at ? (
                  <p className="type-caption mt-1">{formatDateTime(step.at, lang)}</p>
                ) : active ? (
                  <p className="type-caption mt-1">{step.hint}</p>
                ) : null}
                {active && step.at && <p className="type-caption mt-1">{step.hint}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
