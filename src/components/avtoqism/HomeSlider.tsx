/**
 * The band at the top of the home page.
 *
 * Most of what it shows comes from `/ads/slots/HOME_SLIDER`. The API has
 * already merged paid campaigns with the platform's own house banners and
 * decided the order, so this component treats every one of those the same —
 * except for one thing: a paid placement carries a `Reklama` chip, because a
 * visitor is entitled to know when they are being advertised to.
 *
 * On top of those it can carry **one locally-rendered leading slide** the page
 * supplies itself (see `LocalSlide`). That exists for the hero: the hero is
 * personalised to the signed-in person's garage, so it cannot come from a
 * server slot, and it is not advertising, so it must never be reported to
 * `/ads` — an impression or a click counted for it would inflate numbers a
 * seller is billed against.
 *
 * The seam is one array. Both kinds are normalised into `Panel` before
 * anything is drawn, and the dots, the autoplay, the swipe, the keyboard and
 * the index clamp all read that array and nothing else. Exactly two places
 * know the difference: the renderer picks which body to draw, and the
 * impression effect skips anything that is not an ad. There is no "if index
 * is 0" anywhere, and adding a second local slide would need no new branch.
 *
 * Hydration rules it keeps: the first paint is always slide 0, nothing reads
 * storage, `Math.random` or the clock while rendering, and the reduced-motion
 * query is read in an effect rather than during render.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import type { SlideOut } from "@/lib/api/types";
import { useAdSlot, useRecordAdEvent } from "@/lib/query/storefront";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 6_000;

/** How far a finger must travel across before it counts as a swipe. */
const SWIPE_PX = 48;

/** Stable identity, so a re-render never produces a new empty array. */
const NO_SLIDES: SlideOut[] = [];

/**
 * A slide the page draws itself.
 *
 * It gets the same frame, the same transition and the same share of the dots
 * as a server slide, and it is reported to nothing. `render` is handed the
 * slide's own visibility because the rule that applies to every slide in this
 * band applies to it too: an off-screen slide is `aria-hidden`, so any link
 * inside it has to leave the tab order.
 *
 * Pass a stable object — a module constant, or one wrapped in `useMemo`. A new
 * object on every render re-keys the panel list for no reason.
 */
export type LocalSlide = {
  /** React key, and the identity the dots and the panel list are built on. */
  id: string;
  /** What the dot for this slide announces, beyond its position. */
  label?: string | undefined;
  render: (active: boolean) => ReactNode;
};

/**
 * One slide, whatever it came from.
 *
 * A discriminated union rather than an optional `slide` field: `kind` is what
 * the impression effect tests, and a shape where an ad panel could exist
 * without its `SlideOut` is a shape where that test compiles and still sends
 * nulls to the events endpoint.
 */
type Panel =
  | { kind: "local"; key: string; label: string | null; render: (active: boolean) => ReactNode }
  | { kind: "ad"; key: string; label: string | null; slide: SlideOut };

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

export function HomeSlider({ leading }: { leading?: LocalSlide | undefined } = {}) {
  const query = useAdSlot("HOME_SLIDER", { limit: 6 });
  const record = useRecordAdEvent();
  const recordEvent = record.mutate;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const slides = query.data ?? NO_SLIDES;

  const panels = useMemo<Panel[]>(() => {
    const list: Panel[] = [];
    if (leading) {
      list.push({
        kind: "local",
        key: `local:${leading.id}`,
        label: leading.label ?? null,
        render: leading.render,
      });
    }
    for (const [i, slide] of slides.entries()) {
      list.push({ kind: "ad", key: `ad:${i}:${slide.image_url}`, label: null, slide });
    }
    return list;
  }, [leading, slides]);

  const count = panels.length;

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
    const panel = panels[index];
    // The one place the difference matters on the reporting side. A local
    // slide is the page's own content, not a placement, and is counted nowhere.
    if (panel?.kind !== "ad") return;
    const key = impressionKey(panel.slide);
    if (reported.has(key)) return;
    reported.add(key);
    recordEvent({
      kind: "IMPRESSION",
      campaign_id: panel.slide.campaign_id ?? null,
      banner_id: panel.slide.banner_id ?? null,
      creative_id: panel.slide.creative_id ?? null,
    });
  }, [visible, index, panels, recordEvent]);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion || !visible) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, reducedMotion, visible]);

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => (count === 0 ? 0 : (current + delta + count) % count));
    },
    [count],
  );

  /* --- swipe -------------------------------------------------------------
   * Pointer events, mouse excluded: dragging with a mouse across a photo is a
   * selection gesture, not a swipe, and turning it into one steals clicks from
   * the call to action. Nothing calls `preventDefault`, so a vertical drag
   * scrolls the page as usual and arrives here as a cancel.
   */
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.id !== event.pointerId || count < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Horizontal, and decisively so: a diagonal drag belongs to the scroller.
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  };

  const onPointerCancel = () => {
    gesture.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (count < 2) return;
    if (event.key === "ArrowRight") go(1);
    else if (event.key === "ArrowLeft") go(-1);
    else if (event.key === "Home") setIndex(0);
    else if (event.key === "End") setIndex(count - 1);
    else return;
    event.preventDefault();
  };

  // Same box as the real thing, so the rest of the page does not jump when the
  // slot resolves. With a local slide there is always something to draw, so
  // this is only ever the case for a page that supplied none.
  if (count === 0) {
    if (query.isPending) return <div className={cn(BAND, FRAME, "animate-pulse")} />;
    // A broken or empty ad slot is not a broken home page: show nothing.
    return null;
  }

  const onAdClick = (slide: SlideOut) => {
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
      className={BAND}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={onKeyDown}
    >
      <div
        ref={frameRef}
        className={FRAME}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {panels.map((panel, i) => {
          const active = i === index;
          return (
            <div
              key={panel.key}
              aria-hidden={!active}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none",
                active ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {panel.kind === "local" ? (
                panel.render(active)
              ) : (
                <AdPanel
                  slide={panel.slide}
                  active={active}
                  eager={i === 0}
                  onClick={() => onAdClick(panel.slide)}
                />
              )}
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-5 px-5 lg:px-10">
          {panels.map((panel, i) => (
            <button
              key={`dot:${panel.key}`}
              type="button"
              aria-label={panel.label ? `${i + 1}-slayd: ${panel.label}` : `${i + 1}-slayd`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              // The bar is 6px tall. `py-2` makes the tap target 22px and
              // `-my-2` gives the space straight back, so the margin box is
              // the 6px band the design draws and nothing below it moves. The
              // row's vertical gap is wider than 22px, so dots that wrap onto
              // a second line do not overlap the first line's targets.
              className="group -my-2 py-2"
            >
              <span
                className={cn(
                  "block h-1.5 w-8 transition-colors",
                  i === index
                    ? "bg-foreground"
                    : "bg-border group-hover:bg-muted-foreground group-focus-visible:bg-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
      ) : (
        // The slot is still loading behind a local slide. Hold the dots' height
        // so the page does not shift under the reader when they arrive.
        query.isPending && <div className="mt-4 h-1.5" aria-hidden />
      )}

      {/* Which slide is showing, for a screen reader. Silent while the band
          rotates on its own — six seconds is not long enough between
          interruptions to read anything else — and polite once the visitor is
          steering it, which is exactly when autoplay is paused. */}
      {count > 1 && (
        <p
          aria-live={paused || reducedMotion ? "polite" : "off"}
          aria-atomic="true"
          className="sr-only"
        >
          {index + 1} / {count}
        </p>
      )}
    </section>
  );
}

/* --- the shared box --------------------------------------------------------
 * Both the skeleton and the live band use these, so a change to the band's
 * height cannot land in one and not the other.
 *
 * The minimum height is the phone fix. At 360px the 4:3 box is 270px tall, and
 * a three-line headline with a subtitle, two buttons and the trust row does not
 * fit in it — the overflow was simply clipped. Below `md` the box is therefore
 * whichever is taller, the ratio or 24rem; from `md` the 16:7 ratio is roomy
 * enough on its own and the minimum is dropped.
 */
const BAND = "-mx-5 mb-10 lg:-mx-10";
const FRAME =
  "relative aspect-[4/3] min-h-[24rem] w-full overflow-hidden bg-muted md:aspect-[16/7] md:min-h-0";

/**
 * A server slide: photo, scrim, headline, one call to action.
 *
 * The scrim turns with the layout. The text sits at the bottom on a phone and
 * beside the photo from `sm` up, so a left-to-right gradient — which is what
 * this always was — leaves the phone's text over the bright part of the
 * picture. Below `sm` it runs bottom-to-top instead.
 */
function AdPanel({
  slide,
  active,
  eager,
  onClick,
}: {
  slide: SlideOut;
  active: boolean;
  eager: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <img
        src={slide.image_url}
        alt={slide.headline}
        loading={eager ? "eager" : "lazy"}
        className="size-full object-cover"
      />
      {/* Editorial scrim: the text side stays readable whatever the photo does. */}
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/75 via-foreground/40 to-transparent sm:bg-gradient-to-r sm:from-foreground/70 sm:via-foreground/35 sm:to-transparent" />

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
              onClick={onClick}
              className="mt-6 inline-flex items-center gap-2 bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {slide.cta?.trim() || "Ko'rish"}
              <ArrowRight className="size-4" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </>
  );
}
