/**
 * The two files a clip is made of.
 *
 * The server decides what is acceptable and says so precisely — a clip is
 * capped at 200 MB and its type is read from the bytes, so an `.mp4` that is
 * really something else is refused with "Fayl nomidagi kengaytma fayl turiga
 * mos kelmadi" rather than a generic failure. Those sentences are shown exactly
 * as they arrive; nothing here second-guesses them, and the only check made
 * before the upload is the size, because sending 400 MB over a phone connection
 * just to be told it was too large is a cruelty the cap makes avoidable.
 */
import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/avtoqism/panel/Widgets";
import { ApiError } from "@/lib/api/client";
import type { CreatorUploadPurpose, UploadOut } from "@/lib/query/seller";
import { useUploadCreatorFile } from "@/lib/query/seller";

/** Mirrors `MAX_VIDEO_BYTES` and `MAX_IMAGE_BYTES` in `app/modules/uploads`. */
const MAX_BYTES: Record<CreatorUploadPurpose, number> = {
  VIDEO: 200 * 1024 * 1024,
  VIDEO_THUMBNAIL: 5 * 1024 * 1024,
};

const ACCEPT: Record<CreatorUploadPurpose, string> = {
  VIDEO: "video/mp4,video/quicktime",
  VIDEO_THUMBNAIL: "image/jpeg,image/png,image/webp",
};

/** What the client measured about the clip. Advisory only — never a claim. */
export type ClipDimensions = {
  duration_seconds?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
};

/**
 * Read the clip's own header for duration and frame size.
 *
 * Resolves empty when the browser cannot decode it: these three numbers help
 * the feed lay the clip out, and none of them is worth failing an upload over.
 */
async function measure(file: File): Promise<ClipDimensions> {
  if (typeof document === "undefined") return {};
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<ClipDimensions>((resolve) => {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        const seconds = Math.round(probe.duration);
        resolve({
          duration_seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : undefined,
          width: probe.videoWidth || undefined,
          height: probe.videoHeight || undefined,
        });
      };
      probe.onerror = () => resolve({});
      probe.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function MediaUpload({
  sellerId,
  purpose,
  label,
  hint,
  value,
  onUploaded,
  onClear,
}: {
  sellerId: string;
  purpose: CreatorUploadPurpose;
  label: string;
  hint?: string | undefined;
  /** The file already attached, so an edit shows what is there now. */
  value?: { name: string; url: string | null } | undefined;
  onUploaded: (file: UploadOut, dimensions: ClipDimensions) => void;
  onClear?: (() => void) | undefined;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useUploadCreatorFile({ onProgress: setProgress });

  async function pick(file: File) {
    setError(null);
    const limit = MAX_BYTES[purpose];
    if (file.size > limit) {
      setError(`Fayl juda katta. Eng ko'pi ${Math.round(limit / (1024 * 1024))} MB.`);
      return;
    }
    const dimensions = purpose === "VIDEO" ? await measure(file) : {};
    setProgress(0);
    try {
      const row = await upload.mutateAsync({ file, purpose, sellerId });
      onUploaded(row, dimensions);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Faylni yuklab bo'lmadi.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  const busy = progress !== null;

  return (
    <div>
      <span className="type-label mb-1.5 block text-muted-foreground">{label}</span>

      {value ? (
        <div className="flex items-center gap-3 border border-border bg-surface px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm">{value.name}</span>
          {value.url && (
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs font-semibold text-primary"
            >
              Ko'rish
            </a>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Faylni olib tashlash"
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      ) : (
        <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          {busy ? `Yuklanmoqda ${progress}%` : "Fayl tanlash"}
        </Button>
      )}

      <input
        ref={input}
        type="file"
        accept={ACCEPT[purpose]}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
        }}
      />

      {busy && (
        <div
          className="mt-2 h-1.5 w-full bg-muted"
          role="progressbar"
          aria-valuenow={progress ?? 0}
        >
          <div className="h-full bg-primary" style={{ width: `${progress ?? 0}%` }} />
        </div>
      )}
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="type-caption mt-1">{hint}</p>
      ) : null}
    </div>
  );
}
