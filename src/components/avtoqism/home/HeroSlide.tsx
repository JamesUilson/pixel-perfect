/**
 * The home page's own slide, first in the band.
 *
 * It is the hero that used to sit under the carousel as a second full-bleed
 * block. Two stacked full-width bands is one too many on a phone, and the hero
 * was always conceptually one more slide, so it moved inside — laid out like a
 * server slide (photo, scrim, headline, call to action) so the band reads as
 * one thing rather than as a hero wearing a carousel's clothes.
 *
 * What it is not: an advertisement. It is personalised to the signed-in
 * person's garage and it reports nothing to `/ads`. `HomeSlider` guarantees
 * that structurally — a local slide has no `SlideOut` to report — and the
 * `Reklama` chip lives in the server-slide renderer, so this one cannot grow
 * it by accident.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Truck } from "lucide-react";

import cobalt from "@/assets/car-cobalt.jpg";
import { useT } from "@/lib/i18n";
import { useActiveVehicle } from "@/lib/query/garage";

export function HeroSlide({ active }: { active: boolean }) {
  const t = useT();
  const { activeVehicle } = useActiveVehicle();

  const title = activeVehicle
    ? activeVehicle.variant.display_name.split(" ").slice(0, 2).join(" ")
    : t("home.question");

  const subtitle = activeVehicle
    ? [
        String(activeVehicle.year),
        activeVehicle.variant.engine?.displacement_l ?? null,
        activeVehicle.variant.transmission === "AUTOMATIC" ? "Avtomat" : "Mexanika",
      ]
        .filter(Boolean)
        .join(" · ")
    : t("home.noCarSub");

  return (
    <>
      <img
        src={cobalt}
        alt=""
        // First panel of the band, above the fold on every width: it is the
        // largest contentful paint and must not be deferred.
        loading="eager"
        fetchPriority="high"
        className="size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/45 to-foreground/10 sm:bg-gradient-to-r sm:from-foreground/75 sm:via-foreground/40 sm:to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:justify-center sm:p-10 lg:p-14">
        <div className="max-w-xl">
          <p className="type-label mb-2 text-background/75 sm:mb-3">
            {activeVehicle ? "Sizning avtomobilingiz" : "AVTOQISM"}
          </p>
          <h2 className="type-h1 text-background">{title}</h2>
          <p className="mt-2 text-sm text-background/85 sm:mt-3 sm:text-base">{subtitle}</p>

          {/* Only the visible slide is reachable, so a hidden slide's links
              never turn up in the tab order — the rule every slide in this
              band follows. The trust row holds no links and stays put, so the
              slide does not reflow as it fades in. */}
          {active && (
            <div className="mt-5 flex flex-wrap gap-3 sm:mt-6">
              <Link
                to="/garage"
                className="inline-flex items-center gap-2 bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {activeVehicle ? t("home.openGarage") : t("home.addCar")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-2 border border-background/45 px-6 py-3.5 text-sm font-semibold text-background transition-colors hover:bg-background/15"
              >
                {t("nav.market")}
              </Link>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-background/25 pt-4 text-sm text-background/80 sm:mt-6 sm:pt-5">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-5 text-success" aria-hidden /> {t("common.warranty")}
            </span>
            <span className="inline-flex items-center gap-2">
              <Truck className="size-5 text-primary" aria-hidden /> {t("common.delivery")}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
