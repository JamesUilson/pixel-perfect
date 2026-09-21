import { Link } from "@tanstack/react-router";
import { ShieldCheck, UserRound } from "lucide-react";

import { formatPhone } from "@/lib/format";
import { ChoiceRow, Notice, TextField } from "./Fields";
import type { ContactDraft } from "./contact";
import type { FieldErrors } from "./address";

/**
 * Confirm your own number, or name somebody else.
 *
 * When the profile already holds a name and a number the self branch is a
 * read-only confirmation — that is the whole point of having a profile. When it
 * does not, the same two fields appear inline rather than sending the buyer off
 * to the profile screen and losing the cart's promo code on the way.
 */
export function ContactPicker({
  draft,
  onChange,
  errors,
  profileName,
  profilePhone,
}: {
  draft: ContactDraft;
  onChange: (next: ContactDraft) => void;
  errors: FieldErrors;
  profileName: string | null;
  profilePhone: string | null;
}) {
  const profileComplete = Boolean(profileName && profilePhone);

  return (
    <div className="space-y-3">
      <ChoiceRow
        name="contact-mode"
        label="O'zim qabul qilaman"
        description={
          profileComplete
            ? "Kuryer profilingizdagi raqamga qo'ng'iroq qiladi."
            : "Profilingizda raqam yo'q — quyida kiriting."
        }
        checked={draft.isSelf}
        onChange={() => onChange({ ...draft, isSelf: true })}
      />

      {draft.isSelf &&
        (profileComplete ? (
          <div className="border border-border bg-surface p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-success" />
              {draft.selfName}
            </p>
            <p className="type-caption mt-1">{formatPhone(draft.selfPhone) || draft.selfPhone}</p>
            <p className="type-caption mt-2">
              Boshqa raqam kerakmi?{" "}
              <Link to="/profile" className="font-semibold text-primary hover:underline">
                Profilda o'zgartiring
              </Link>{" "}
              yoki pastda boshqa shaxsni tanlang.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2">
            <TextField
              label="Ism familiyangiz"
              value={draft.selfName}
              onChange={(value) => onChange({ ...draft, selfName: value })}
              error={errors["contact_name"]}
              autoComplete="name"
              maxLength={120}
              required
            />
            <TextField
              label="Telefon raqamingiz"
              value={draft.selfPhone}
              onChange={(value) => onChange({ ...draft, selfPhone: value })}
              error={errors["contact_phone"]}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              required
            />
          </div>
        ))}

      <ChoiceRow
        name="contact-mode"
        label="Boshqa shaxs qabul qiladi"
        description="Masalan ustaxona yoki qarindosh. Ism va raqam ikkalasi ham kerak."
        checked={!draft.isSelf}
        onChange={() => onChange({ ...draft, isSelf: false })}
      />

      {!draft.isSelf && (
        <div className="space-y-4 border border-border bg-surface p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Qabul qiluvchining ismi"
              value={draft.otherName}
              onChange={(value) => onChange({ ...draft, otherName: value })}
              error={errors["contact_name"]}
              autoComplete="off"
              maxLength={120}
              placeholder="Usta Akmal"
              required
            />
            <TextField
              label="Qabul qiluvchining telefoni"
              value={draft.otherPhone}
              onChange={(value) => onChange({ ...draft, otherPhone: value })}
              error={errors["contact_phone"]}
              autoComplete="off"
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              required
            />
          </div>
          <Notice tone="info" title="Kuryer shu raqamga qo'ng'iroq qiladi">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-3.5" />
              Buyurtma holati haqidagi xabarlar esa sizga keladi.
            </span>
          </Notice>
        </div>
      )}
    </div>
  );
}
