/**
 * Registration, in two steps, because that is what the API does now.
 *
 * `POST /auth/register/start` creates the account and sends a code;
 * `POST /auth/register/verify` accepts the code and signs the person in. The
 * first call answers identically whether or not the contact was already taken —
 * that is deliberate on the server's side, so nothing on this screen may claim
 * otherwise. "Kod yuborildi" is the only honest thing to say, and it is what is
 * said for everybody.
 *
 * The fields themselves are `components/avtoqism/account/AccountForm.tsx`: the
 * seller path opens the same account with the same rules, and this page is now
 * the buyer's framing around that form.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/avtoqism/Page";
import { AccountForm } from "@/components/avtoqism/account/AccountForm";
import type { RegistrationStart } from "@/components/avtoqism/account/AccountForm";
import { UnverifiedLimits } from "@/components/avtoqism/auth/VerificationPrompt";
import { VerificationCodeForm } from "@/components/avtoqism/auth/VerificationCodeForm";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [{ title: "Ro'yxatdan o'tish — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const t = useT();
  const navigate = useNavigate();

  /** Set once the code is on its way; the code step goes over the form. */
  const [started, setStarted] = useState<RegistrationStart | null>(null);

  return (
    <Page className="max-w-md">
      {started !== null ? (
        <>
          <h1 className="type-h1">Tasdiqlash</h1>
          <p className="type-caption mt-3">
            Ro'yxatdan o'tishni yakunlash uchun kodni kiriting. Kod kelmasa — raqamni tekshiring va
            qayta so'rang.
          </p>

          <div className="mt-8">
            <VerificationCodeForm
              identifier={started.identifier}
              initialResendAfter={started.resendAfter}
              onVerified={() => {
                toast.success("Hisobingiz tasdiqlandi.");
                void navigate({ to: "/garage/add" });
              }}
              onChangeIdentifier={() => setStarted(null)}
            />
          </div>

          <div className="mt-8 border border-border bg-card p-4">
            <p className="type-label text-muted-foreground">
              Tasdiqlanmagan hisob nima qila olmaydi
            </p>
            <UnverifiedLimits className="mt-2" />
          </div>

          {/*
           * `/auth/register/start` has already created the account by the time
           * this step is on screen, and an unverified account may sign in and
           * browse. Without saying so, somebody whose SMS never arrives is stuck
           * on a code box with no way forward and no idea they have an account at
           * all — and the next thing they do is register again with another
           * number.
           */}
          <div className="mt-4 border border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold">Kod kelmadi va kuta olmayapsizmi?</p>
            <p className="type-caption mt-1">
              Hisobingiz allaqachon yaratilgan. Kirib katalogni ko'rishingiz mumkin, tasdiqlashni
              esa keyinroq profil sahifasidan yakunlaysiz — qaytadan ro'yxatdan o'tish kerak emas.
            </p>
            <Link
              to="/login"
              className="mt-3 inline-flex border border-border-strong bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
            >
              {t("auth.login")}
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="type-h1">{t("auth.register")}</h1>
          <p className="type-caption mt-3">
            Hisob yarating va mashinangizni garajga qo'shing — keyin faqat mos detallarni ko'rasiz.
          </p>
        </>
      )}

      {/*
       * The form is hidden behind the code step rather than unmounted, because
       * "Boshqa raqam kiritish" has to come back to a filled-in form: the name,
       * the region and the chosen channel are still right, and only the contact
       * was wrong. Unmounting would charge the whole form for one wrong digit.
       */}
      <div className={cn("mt-8", started !== null && "hidden")}>
        <AccountForm onStarted={setStarted} />
      </div>

      {started === null && (
        <>
          <p className="type-caption mt-6">
            {t("auth.hasAccount")}{" "}
            <Link to="/login" className="font-semibold text-primary">
              {t("auth.login")}
            </Link>
          </p>

          {/* One account, two uses: a seller opens a store on top of it. The seller
          path is now a door of its own rather than a mention — it walks the
          same account step, then verification, then the store — so this points
          at that and says what it ends in. */}
          <div className="mt-8 border-t border-border pt-6">
            <p className="text-sm font-semibold">Sotmoqchimisiz?</p>
            <p className="type-caption mt-1">
              Sotuvchi bo'lish uchun alohida yo'l bor: hisob → tasdiqlash → do'kon ma'lumotlari.
              Do'kon administrator tasdig'idan keyin katalogda ko'rinadi — ro'yxatdan o'tish bepul,
              komissiya faqat sotuvdan olinadi.
            </p>
            <Link
              to="/register/seller"
              className="mt-3 inline-flex w-full items-center justify-center border border-border-strong bg-surface px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Sotuvchi sifatida ro'yxatdan o'tish
            </Link>
          </div>
        </>
      )}
    </Page>
  );
}
