/**
 * What the slide will look like where it is actually bought.
 *
 * The markup mirrors `components/avtoqism/HomeSlider.tsx` — the same frame
 * ratio, the same editorial scrim, the same `Reklama` chip, the same type
 * scale — so a seller composing a creative is looking at the real thing rather
 * than an approximation of it. HomeSlider itself is left alone: it renders live
 * ads, it reports impressions and it runs a carousel, none of which belongs in
 * a form. Keeping the two in step is a deliberate, small duplication of markup;
 * the alternative is a shared component that has to be told which of its
 * behaviours to switch off, which is how sliders start firing impressions for
 * ads nobody has bought yet.
 *
 * Slots other than the home slider are drawn in a plainer, banner-shaped frame,
 * because that is closer to what they are and pretending otherwise would be the
 * same mistake in the other direction.
 */
import { ArrowRight, ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function SlidePreview({
  slot,
  imageUrl,
  headline,
  subtitle,
  cta,
  className,
}: {
  slot: string;
  imageUrl: string | null;
  headline: string;
  subtitle: string;
  cta: string;
  className?: string | undefined;
}) {
  const hero = slot === "HOME_SLIDER";

  return (
    <div className={cn("border border-border bg-card", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden bg-muted",
          hero ? "aspect-[4/3] md:aspect-[16/7]" : "aspect-[16/6]",
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center">
            <div className="text-center">
              <ImageIcon className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden />
              <p className="type-caption">Rasm yuklang — ko'rinishi shu yerda chiqadi.</p>
            </div>
          </div>
        )}

        {imageUrl && (
          <>
            {/* Editorial scrim: the text side stays readable whatever the photo does. */}
            <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/35 to-transparent" />

            <div
              className={cn(
                "absolute inset-0 flex flex-col justify-end",
                hero ? "p-6 sm:justify-center sm:p-10" : "p-5",
              )}
            >
              <div className="max-w-xl">
                <span className="mb-3 inline-flex items-center border border-background/40 bg-background/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-background">
                  Reklama
                </span>
                <h2 className={cn("text-background", hero ? "type-h1" : "type-h3 text-background")}>
                  {headline.trim() || "Sarlavha"}
                </h2>
                {subtitle.trim() !== "" && (
                  <p className="mt-3 text-sm text-background/85 sm:text-base">{subtitle}</p>
                )}
                <span className="mt-6 inline-flex items-center gap-2 bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground">
                  {cta.trim() || "Ko'rish"}
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <p className="type-caption border-t border-border px-4 py-2.5">
        Taxminiy ko'rinish. Haqiqiy o'lcham qurilmaga qarab o'zgaradi, matn esa aynan shunday
        chiqadi.
      </p>
    </div>
  );
}
