/**
 * Who the driver rings at the door.
 *
 * Defaults to the buyer's own profile phone. A buyer sending a part to their
 * mechanic names the mechanic instead, and the server refuses that without both
 * a name and a number — so the form refuses it first, where the person can
 * still see what they typed.
 */
import type { CheckoutContact } from "@/lib/query/commerce";
import { PHONE_RE, normalisePhone, type FieldErrors } from "./address";

export type ContactDraft = {
  isSelf: boolean;
  /** Seeded from the profile; editable only when the profile left it blank. */
  selfName: string;
  selfPhone: string;
  otherName: string;
  otherPhone: string;
};

export function emptyContactDraft(): ContactDraft {
  return { isSelf: true, selfName: "", selfPhone: "", otherName: "", otherPhone: "" };
}

export function validateContact(draft: ContactDraft): FieldErrors {
  const errors: FieldErrors = {};
  const name = draft.isSelf ? draft.selfName : draft.otherName;
  const phone = draft.isSelf ? draft.selfPhone : draft.otherPhone;

  if (name.trim().length < 2) errors["contact_name"] = "Ism familiyani kiriting";
  if (!PHONE_RE.test(phone.replace(/[\s()-]/g, "")))
    errors["contact_phone"] = "Telefon raqami noto'g'ri";
  return errors;
}

/** The `contact` block, and the name and phone the address should carry. */
export function resolveContact(draft: ContactDraft): CheckoutContact {
  const name = (draft.isSelf ? draft.selfName : draft.otherName).trim();
  const phone = normalisePhone(draft.isSelf ? draft.selfPhone : draft.otherPhone);
  return { is_self: draft.isSelf, name, phone };
}
