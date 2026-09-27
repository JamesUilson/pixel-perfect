import { Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatClock, playableUrl } from "./util";
import type { FeedVideo, WatchReport } from "@/lib/query/feed";
import { cn } from "@/lib/utils";

/** Below this, a clip that went past counts as skipped rather than watched. */
const SKIP_THRESHOLD_MS = 2_000;
/** A view worth reporting at all. Anything shorter is a scroll, not a watch. */
const MIN_REPORTABLE_MS = 600;
/** Within this much of the end, the clip counts as finished. */
const COMPLETION_SLACK_SECONDS = 0.35;

type Props = {
  video: FeedVideo;
  /** True while this is the clip on screen. Playback and the clock follow it. */
  active: boolean;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  /** Called once per visit, when the clip stops being the active one. */
  onWatched: (report: WatchReport) => void;
  /** The detail screen draws a scrubber; the scroller does not. */
  showProgress?: boolean | undefined;
  className?: string | undefined;
  children?: React.ReactNode;
};

/**
 * The clip surface: the media, and the measurement of how long it was watched.
 *
 * Two things are deliberate here.
 *
 * **There is no transcoder yet.** When the API gives a playable URL this
 * renders a `<video>`; when it does not, it renders the poster and no play
 * affordance, because a play button over a still that cannot play is a lie.
 *
 * **Watch time is measured, not assumed.** A visit accrues real milliseconds
 * while the clip is on screen and playing, and the accrued total is reported
 * once when the clip is left. `completed` comes from the media element
 * reaching its end, or — for a poster, which cannot end — never.
 */
export function VideoStage({
  video,
  active,
  muted,
  onMutedChange,
  onWatched,
  showProgress = false,
  className,
  children,
}: Props) {
  const src = playableUrl(video);
  const elementRef = useRef<HTMLVideoElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(video.duration_seconds ?? 0);

  // Refs, not state: the clock must not re-render anything per tick, and the
  // unmount reporter must read the final value without a stale closure.
  const accruedRef = useRef(0);
  const runningSinceRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const onWatchedRef = useRef(onWatched);
  onWatchedRef.current = onWatched;

  const startClock = useCallback(() => {
    runningSinceRef.current ??= Date.now();
  }, []);

  const stopClock = useCallback(() => {
    const since = runningSinceRef.current;
    if (since === null) return;
    accruedRef.current += Date.now() - since;
    runningSinceRef.current = null;
  }, []);

  /** Hand over what this visit measured, and start a fresh one. */
  const flush = useCallback(() => {
    stopClock();
    const watchMs = accruedRef.current;
    accruedRef.current = 0;
    if (watchMs < MIN_REPORTABLE_MS) {
      completedRef.current = false;
      return;
    }
    onWatchedRef.current({
      watchMs,
      completed: completedRef.current,
      skipped: !completedRef.current && watchMs < SKIP_THRESHOLD_MS,
    });
    completedRef.current = false;
  }, [stopClock]);

  // Playback and the clock both follow `active`, so a clip that scrolled away
  // is neither playing nor counting.
  useEffect(() => {
    const element = elementRef.current;
    if (active) {
      startClock();
      if (element) {
        const attempt = element.play();
        // Autoplay can be refused (a page the person has not interacted with);
        // the poster and the play button stay, which is the honest result.
        if (attempt) attempt.catch(() => setPlaying(false));
      }
      return;
    }
    element?.pause();
    setPlaying(false);
    flush();
  }, [active, flush, startClock]);

  // The last visit still has to be reported when the screen goes away.
  useEffect(() => () => flush(), [flush]);

  // A backgrounded tab is not watching.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopClock();
        elementRef.current?.pause();
      } else if (active) {
        startClock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, startClock, stopClock]);

  const togglePlay = () => {
    const element = elementRef.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  };

  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;

  return (
    <div className={cn("relative isolate overflow-hidden bg-muted", className)}>
      {src ? (
        <video
          ref={elementRef}
          src={src}
          poster={video.thumbnail_url ?? undefined}
          className="absolute inset-0 size-full object-cover"
          playsInline
          loop={false}
          muted={muted}
          preload="metadata"
          onPlay={() => {
            setPlaying(true);
            if (active) startClock();
          }}
          onPause={() => {
            setPlaying(false);
            stopClock();
          }}
          onTimeUpdate={(event) => {
            const element = event.currentTarget;
            setElapsed(element.currentTime);
            if (
              element.duration > 0 &&
              element.currentTime >= element.duration - COMPLETION_SLACK_SECONDS
            ) {
              completedRef.current = true;
            }
          }}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setDuration(value);
          }}
          onEnded={() => {
            completedRef.current = true;
            setPlaying(false);
            stopClock();
          }}
        />
      ) : video.thumbnail_url ? (
        <img
          src={video.thumbnail_url}
          alt={video.caption ?? "Video posteri"}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-muted">
          <p className="type-caption px-6 text-center">Video hali tayyor emas.</p>
        </div>
      )}

      {/* The scrim the design draws, in whichever theme is running. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/10 to-background/35" />

      {src ? (
        <>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "To'xtatish" : "Ijro etish"}
            className="absolute inset-0 z-10 grid place-items-center"
          >
            {!playing && (
              <span className="grid size-16 place-items-center rounded-full border border-border bg-background/40 text-foreground backdrop-blur-sm">
                <Play className="ml-1 size-6 fill-current" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onMutedChange(!muted)}
            aria-label={muted ? "Ovozni yoqish" : "Ovozni o'chirish"}
            aria-pressed={!muted}
            className="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full bg-background/45 text-foreground backdrop-blur-sm"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        </>
      ) : (
        <p className="absolute left-4 top-4 z-20 rounded-full bg-background/60 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm">
          Video hozircha faqat rasm sifatida
        </p>
      )}

      {showProgress && (
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold tabular-nums">
            <span>{formatClock(elapsed)}</span>
            <span className="text-muted-foreground">
              {duration > 0 ? formatClock(duration) : "—"}
            </span>
          </div>
          <div
            className="relative h-1 w-full bg-foreground/20"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label="Video davomiyligi"
          >
            <div
              className="absolute inset-y-0 left-0 bg-primary"
              style={{ width: `${progress * 100}%` }}
            />
            <span
              className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
