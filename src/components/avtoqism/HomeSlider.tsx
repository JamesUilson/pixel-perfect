/**
 * The home page hero.
 *
 * It renders whatever `/ads/slots/HOME_SLIDER` hands back. The API has already
 * merged paid campaigns with the platform's own house banners and decided the
 * order, so this component treats every slide the same — except for one thing:
 * a paid placement carries a `Reklama` chip, because a visitor is entitled to
 * know when they are being advertised to.
 *
 * Hydration rules it keeps: the first paint is always slide 0, nothing reads
 * storage, `Math.random` or the clock while rendering, and the reduced-motion
 * query is read in an effect rather than during render.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import type { SlideOut } from "@/lib/api/types";
import { useAdSlot, useRecordAdEvent } from "@/lib/query/storefront";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 6_000;

/** Stable identity, so a re-render never produces a new empty array. */
const NO_SLIDES: SlideOut[] = [];

/**
 * Impressions already reported in this browser session.
 *
 * Module-level rather than component state: navigating away from the home page
 * and back remounts the slider, and the same slide seen twice in one session is
 * one impression, not two. The server de-duplicates as well, by session id —
 * this just avoids making the request at all.
 */
const reported = new Set<string>();

function impressionKey(slide: SlideOut): string {
  return [
    slide.campaign_id ?? "",
    slide.banner_id ?? "",
    slide.creative_id ?? "",
    slide.image_url,
  ].join("|");
}

export function HomeSlider() {
  const query = useAdSlot("HOME_SLIDER", { limit: 6 });
  const record = useRecordAdEvent();
  const recordEvent = record.mutate;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const slides = query.data ?? NO_SLIDES;
  const count = slides.length;

  // A refetch can return fewer slides than before; never point past the end.
  useEffect(() => {
    setIndex((current) => (current < count ? current : 0));
  }, [count]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // An impression means the slide was actually on screen, not merely mounted.
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  useEffect(() => {
    if (!visible) return;
    const slide = slides[index];
    if (!slide) return;
    const key = impressionKey(slide);
    if (reported.has(key)) return;
    reported.add(key);
    recordEvent({
      kind: "IMPRESSION",
      campaign_id: slide.campaign_id ?? null,
      banner_id: slide.banner_id ?? null,
      creative_id: slide.creative_id ?? null,
    });
  }, [visible, index, slides, recordEvent]);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion || !visible) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, reducedMotion, visible]);

  // Same box as the real thing, so the rest of the page does not jump when the
  // slot resolves.
  if (query.isPending) {
    return (
      <div className="-mx-5 mb-10 aspect-[4/3] animate-pulse bg-muted md:aspect-[16/7] lg:-mx-10" />
    );
  }

  // A broken or empty ad slot is not a broken home page: show nothing.
  if (query.isError || count === 0) return null;

  const onClick = (slide: SlideOut) => {
    recordEvent({
      kind: "CLICK",
      campaign_id: slide.campaign_id ?? null,
      banner_id: slide.banner_id ?? null,
      creative_id: slide.creative_id ?? null,
    });
  };

  return (
    <section
      aria-roledescription="karusel"
      aria-label="Tanlangan takliflar"
      className="-mx-5 mb-10 lg:-mx-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={frameRef}
        className="relative aspect-[4/3] w-full overflow-hidden bg-muted md:aspect-[16/7]"
      >
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={`${i}:${slide.image_url}`}
              aria-hidden={!active}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none",
                active ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <img
                src={slide.image_url}
                alt={slide.headline}
                loading={i === 0 ? "eager" : "lazy"}
                className="size-full object-cover"
              />
              {/* Editorial scrim: the text side stays readable whatever the photo does. */}
              <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/35 to-transparent" />

              <div className="absolute inset-0 flex flex-col justify-end p-6 sm:justify-center sm:p-10 lg:p-14">
                <div className="max-w-xl">
                  {slide.sponsored && (
                    <span className="mb-3 inline-flex items-center border border-background/40 bg-background/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-background">
                      Reklama
                    </span>
                  )}
                  <h2 className="type-h1 text-background">{slide.headline}</h2>
                  {slide.subtitle && (
                    <p className="mt-3 text-sm text-background/85 sm:text-base">{slide.subtitle}</p>
                  )}
                  {/* Only the visible slide is reachable, so a hidden slide's
                      CTA never turns up in the tab order. */}
                  {active && slide.link_url && (
                    <a
                      href={slide.link_url}
                      onClick={() => onClick(slide)}
                      className="mt-6 inline-flex items-center gap-2 bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      {slide.cta?.trim() || "Ko'rish"}
                      <ArrowRight className="size-4" aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 px-5 lg:px-10">
          {slides.map((slide, i) => (
            <button
              key={`dot:${i}:${slide.image_url}`}
              type="button"
              aria-label={`${i + 1}-slayd`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 w-8 transition-colors",
                i === index ? "bg-foreground" : "bg-border hover:bg-muted-foreground",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
