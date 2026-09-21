/**
 * Eski yozuvlarni tozalash — the one destructive button on the system screen.
 *
 * It deletes request-log rows permanently and nothing else ever empties that
 * table, so the card is shaped to slow a person down: the consequence in plain
 * words, the exact number of days being deleted echoed back, and a typed
 * confirmation before the request is sent.
 *
 * The button is shown to every member of staff on purpose. The endpoint is
 * SUPER_ADMIN only and the server enforces that; hiding the control on a guess
 * about the current person's roles would replace a clear "ruxsat yo'q" from the
 * API with a missing feature nobody can explain.
 */
import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button, Field, Input, Panel } from "@/components/avtoqism/panel/Widgets";
import { groupDigits } from "@/lib/format";
import { usePurgeRequestLogs, useSystemHealth } from "@/lib/query/admin";

const CONFIRM_WORD = "TOZALASH";

export function LogPurgeCard() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("");
  const [typed, setTyped] = useState("");

  const purge = usePurgeRequestLogs();
  const health = useSystemHealth();

  const retention = health.data?.traffic.retention_days;
  const parsed = Number.parseInt(days, 10);
  const effective = Number.isFinite(parsed) && parsed >= 1 ? parsed : (retention ?? null);
  const validDays =
    days.trim() === "" || (Number.isFinite(parsed) && parsed >= 1 && parsed <= 3650);

  function close() {
    setOpen(false);
    setTyped("");
  }

  return (
    <section className="border-2 border-destructive/50 bg-destructive/5 p-5">
      <h3 className="type-h3 text-destructive">Eski so'rov yozuvlarini o'chirish</h3>
      <p className="type-caption mt-2 max-w-3xl">
        Bu amal so'rovlar jurnalidan eski qatorlarni butunlay o'chiradi — qaytarib bo'lmaydi va bu
        jadvalni boshqa hech narsa tozalamaydi. Audit jurnaliga tegmaydi. Faqat bosh administrator
        bajara oladi; boshqa xodimga server «ruxsat yo'q» deb javob beradi.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field
          label="Necha kundan eskisini"
          className="w-56"
          hint={
            retention
              ? `Bo'sh qoldirilsa server sozlamasi ishlatiladi: ${groupDigits(retention)} kun.`
              : "Bo'sh qoldirilsa server sozlamasidagi muddat ishlatiladi."
          }
          error={validDays ? undefined : "1 dan 3650 gacha bo'lgan kun soni."}
        >
          <Input
            value={days}
            onChange={(event) => setDays(event.target.value)}
            inputMode="numeric"
            placeholder={retention ? String(retention) : "90"}
          />
        </Field>
        <Button
          variant="danger"
          disabled={!validDays || purge.isPending}
          onClick={() => {
            purge.reset();
            setTyped("");
            setOpen(true);
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          Tozalashni boshlash
        </Button>
      </div>

      {purge.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {purge.error.message}
        </p>
      )}

      {purge.isSuccess && (
        <p className="mt-3 text-sm text-success">
          {groupDigits(purge.data.deleted)} ta yozuv o'chirildi (
          {groupDigits(purge.data.older_than_days)} kundan eskisi).
        </p>
      )}

      <Panel open={open} title="Tozalashni tasdiqlash" onClose={close}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed !== CONFIRM_WORD) return;
            purge.mutate(Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined, {
              onSuccess: close,
            });
          }}
        >
          <p className="border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {effective === null
              ? "Server sozlamasidagi muddatdan eski barcha so'rov yozuvlari butunlay o'chiriladi."
              : `${groupDigits(effective)} kundan eski barcha so'rov yozuvlari butunlay o'chiriladi.`}{" "}
            Bu amalni bekor qilib bo'lmaydi.
          </p>

          <Field label={`Tasdiqlash uchun «${CONFIRM_WORD}» deb yozing`}>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          {purge.isError && (
            <p role="alert" className="text-sm text-destructive">
              {purge.error.message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="danger"
              disabled={typed !== CONFIRM_WORD || purge.isPending}
            >
              {purge.isPending ? "O'chirilmoqda…" : "Butunlay o'chirish"}
            </Button>
            <Button type="button" variant="ghost" onClick={close} disabled={purge.isPending}>
              Bekor qilish
            </Button>
          </div>
        </form>
      </Panel>
    </section>
  );
}
