/**
 * Theme and language.
 *
 * Both are the same kind of setting — a choice with three or two answers that
 * applies the instant it is made — so they share a card and a control. Neither
 * has a save button: a preference you have to confirm is a preference you cannot
 * try, and the whole point of a theme switch is seeing the result.
 *
 * Where the choice is kept:
 *   - localStorage always, because a signed-out visitor is entitled to a dark
 *     screen too, and because the bootstrap in `__root.tsx` reads it before the
 *     first paint;
 *   - the account as well, when there is one, so the next device starts right.
 *
 * The device is the authority for what is on screen now. The account only ever
 * gets consulted on a device that has never been asked — see
 * `useAdoptServerVisualPreferences`.
 */
import type { ReactNode } from "react";
import { Languages, Monitor, Moon, Palette, Sun } from "lucide-react";

import { ChoiceGroup, SettingRow, SettingsCard } from "./Primitives";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { useIsAuthenticated } from "@/lib/query/session";
import {
  mirrorPreference,
  setVisualPreferences,
  useSystemPrefersDark,
  useVisualPreferences,
  type ThemeChoice,
} from "@/lib/query/settings";

export const APPEARANCE_ID = "korinish";
export const LANGUAGE_ID = "til";

export function AppearanceSection() {
  const t = useT();
  const { theme } = useVisualPreferences();
  const systemDark = useSystemPrefersDark();
  const signedIn = useIsAuthenticated();

  const themeOptions: readonly { value: ThemeChoice; label: string; hint?: string }[] = [
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") },
    {
      value: "system",
      label: t("settings.themeSystem"),
      // Naming what "system" currently means: otherwise the option that is
      // selected is the one option whose result is invisible.
      hint: `${t("settings.themeSystemNow")}: ${
        systemDark ? t("settings.themeDark") : t("settings.themeLight")
      }`,
    },
  ];

  const icons: Record<ThemeChoice, ReactNode> = {
    light: <Sun className="size-4" aria-hidden />,
    dark: <Moon className="size-4" aria-hidden />,
    system: <Monitor className="size-4" aria-hidden />,
  };

  return (
    <SettingsCard
      id={APPEARANCE_ID}
      icon={Palette}
      title={t("settings.appearance")}
      subtitle={t("settings.appearanceSub")}
      footer={
        <p className="type-caption">
          {signedIn ? t("settings.savedOnAccount") : t("settings.savedOnDevice")}
        </p>
      }
    >
      <SettingRow label={t("settings.theme")} hint={t("settings.themeSystemHint")}>
        <ChoiceGroup
          name={t("settings.theme")}
          value={theme}
          options={themeOptions.map((option) => ({ ...option, icon: icons[option.value] }))}
          onChange={(next) => {
            setVisualPreferences({ theme: next });
            mirrorPreference({ theme: next });
          }}
        />
      </SettingRow>
    </SettingsCard>
  );
}

export function LanguageSection() {
  const t = useT();
  const { lang, setLang } = useLang();
  const signedIn = useIsAuthenticated();

  // Each language names itself in itself — a Russian speaker looking for their
  // language should not first have to find it under an Uzbek name.
  const options: readonly { value: Lang; label: string; hint?: string }[] = [
    { value: "uz", label: "O'zbekcha", hint: "Lotin" },
    { value: "ru", label: "Русский", hint: "Русский язык" },
  ];

  return (
    <SettingsCard
      id={LANGUAGE_ID}
      icon={Languages}
      title={t("settings.language")}
      subtitle={t("settings.languageSub")}
      footer={
        <p className="type-caption">
          {signedIn ? t("settings.savedOnAccount") : t("settings.savedOnDevice")}
        </p>
      }
    >
      <SettingRow label={t("settings.language")}>
        {/* Two options in a three-column grid would leave a hole. */}
        <ChoiceGroup
          name={t("settings.language")}
          value={lang}
          options={options}
          onChange={setLang}
          className="sm:grid-cols-2"
        />
      </SettingRow>
    </SettingsCard>
  );
}
