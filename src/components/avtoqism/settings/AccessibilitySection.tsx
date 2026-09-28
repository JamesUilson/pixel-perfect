/**
 * Three switches, and what each one actually does.
 *
 * The rule this section was written to: a toggle that changes nothing is worse
 * than no toggle, because it teaches somebody that this app's accessibility
 * settings are decoration. So each row states its effect in the words of what
 * changes on screen, and the effect is in `styles.css` keyed off an attribute
 * this section sets on `<html>`:
 *
 *   - `data-reduce-motion`  — every animation and transition collapses, the
 *     home slider stops advancing, the image zoom stops zooming, and
 *     `prefersReducedMotion()` reports true so a surface that autoplays can
 *     decline to start.
 *   - `data-text-lg`        — the root font size goes to 112.5%, which scales
 *     every rem in the app: type, spacing and tap targets together.
 *   - `data-high-contrast`  — the two border steps and muted text are pushed up;
 *     nothing else in the palette moves.
 *
 * They are applied the instant they are switched, with no save button, for the
 * same reason as the theme: the result is the confirmation.
 */
import { Accessibility } from "lucide-react";

import { SettingRow, SettingsCard, Switch } from "./Primitives";
import { useT } from "@/lib/i18n";
import { useIsAuthenticated } from "@/lib/query/session";
import {
  mirrorPreference,
  setVisualPreferences,
  useVisualPreferences,
  type PreferencesPatch,
  type VisualPreferences,
} from "@/lib/query/settings";

export const ACCESSIBILITY_ID = "maxsus-imkoniyatlar";

/**
 * Each switch: where it reads from, and the two writes it makes.
 *
 * The writes are spelled out as functions rather than derived from a key, so
 * both the browser field and the server field it mirrors are checked by the
 * compiler. A computed key would type as `string` and let a rename through.
 */
type SwitchSpec = {
  key: "reducedMotion" | "largerText" | "highContrast";
  id: string;
  read: (prefs: VisualPreferences) => boolean;
  write: (value: boolean) => { local: Partial<VisualPreferences>; server: PreferencesPatch };
};

const SWITCHES: readonly SwitchSpec[] = [
  {
    key: "reducedMotion",
    id: "a11y-motion",
    read: (prefs) => prefs.reducedMotion,
    write: (value) => ({ local: { reducedMotion: value }, server: { reduced_motion: value } }),
  },
  {
    key: "largerText",
    id: "a11y-text",
    read: (prefs) => prefs.largerText,
    write: (value) => ({ local: { largerText: value }, server: { larger_text: value } }),
  },
  {
    key: "highContrast",
    id: "a11y-contrast",
    read: (prefs) => prefs.highContrast,
    write: (value) => ({ local: { highContrast: value }, server: { high_contrast: value } }),
  },
];

export function AccessibilitySection() {
  const t = useT();
  const prefs = useVisualPreferences();
  const signedIn = useIsAuthenticated();

  const labels: Record<SwitchSpec["key"], { label: string; hint: string }> = {
    reducedMotion: {
      label: t("settings.reduceMotion"),
      hint: t("settings.reduceMotionSub"),
    },
    largerText: { label: t("settings.largerText"), hint: t("settings.largerTextSub") },
    highContrast: { label: t("settings.highContrast"), hint: t("settings.highContrastSub") },
  };

  return (
    <SettingsCard
      id={ACCESSIBILITY_ID}
      icon={Accessibility}
      title={t("settings.a11y")}
      subtitle={t("settings.a11ySub")}
      footer={
        <p className="type-caption">
          {signedIn ? t("settings.savedOnAccount") : t("settings.savedOnDevice")}
        </p>
      }
    >
      {SWITCHES.map((spec) => (
        <SettingRow
          key={spec.key}
          htmlFor={spec.id}
          label={labels[spec.key].label}
          hint={labels[spec.key].hint}
          control={
            <Switch
              id={spec.id}
              label={labels[spec.key].label}
              checked={spec.read(prefs)}
              onChange={(next) => {
                const { local, server } = spec.write(next);
                setVisualPreferences(local);
                mirrorPreference(server);
              }}
            />
          }
        />
      ))}
    </SettingsCard>
  );
}
