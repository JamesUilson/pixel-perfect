/**
 * Sending a file to the server, with something to look at while it goes.
 *
 * Three things make this worth a component rather than an `<input type=file>`:
 * the seller has to see what is currently stored, an upload over a phone
 * connection needs a bar that moves, and a refused file has to say why. The
 * server already explains itself precisely — wrong type, too large, unreadable
 * image — so its sentence is shown rather than a generic failure. The limits
 * below only stop a file that is certain to be refused, saving the upload.
 */
import { useRef, useState } from "react";
import { FileText, ImageUp, Loader2, Paperclip, ShieldCheck } from "lucide-react";

import { Button } from "@/components/avtoqism/panel/Widgets";
import { formatDate } from "@/lib/format";
import { useUploadFile } from "@/lib/query/seller";
import type { UploadOut, UploadPurpose } from "@/lib/query/seller";
import { cn } from "@/lib/utils";

const MB = 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** A licence photographed on a phone is the normal case, so images count too. */
const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];

const MAX_IMAGE_BYTES = 5 * MB;
const MAX_DOCUMENT_BYTES = 10 * MB;

function isDocument(purpose: UploadPurpose): boolean {
  return purpose === "SELLER_DOCUMENT";
}

function acceptFor(purpose: UploadPurpose): string {
  return (isDocument(purpose) ? DOCUMENT_TYPES : IMAGE_TYPES).join(",");
}

/** The one refusal worth making without asking the server. */
function tooLarge(file: File, purpose: UploadPurpose): string | null {
  const limit = isDocument(purpose) ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES;
  if (file.size <= limit) return null;
  return `Fayl juda katta. Eng ko'pi ${limit / MB} MB.`;
}

function humanSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Shared plumbing for both controls: pick, validate, send, report. */
function useUploadControl(
  purpose: UploadPurpose,
  sellerId: string,
  onUploaded: (file: UploadOut) => void,
) {
  const [progress, setProgress] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const upload = useUploadFile({ onProgress: setProgress });

  function choose(file: File | undefined) {
    if (!file) return;
    const refusal = tooLarge(file, purpose);
    if (refusal) {
      setLocalError(refusal);
      return;
    }
    setLocalError(null);
    setProgress(0);
    upload.mutate(
      { file, purpose, sellerId },
      {
        onSuccess: (row) => {
          setProgress(null);
          onUploaded(row);
        },
        onError: () => setProgress(null),
      },
    );
  }

  const error = localError ?? (upload.isError ? upload.error.message : null);

  return { progress, error, busy: upload.isPending, inputRef, choose, done: upload.isSuccess };
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="h-1.5 w-full bg-muted"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Yuklanmoqda"
    >
      <div
        className="h-full bg-primary transition-[width] duration-200"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * One store image: the logo, the square icon or the wide banner.
 *
 * The frame is the shape the image will actually be used in, so a banner
 * uploaded as a square is obvious here rather than on the shop page.
 */
export function ImageUpload({
  label,
  hint,
  purpose,
  sellerId,
  value,
  shape = "square",
  onUploaded,
}: {
  label: string;
  hint?: string | undefined;
  purpose: UploadPurpose;
  sellerId: string;
  /** The URL currently stored on the store, if any. */
  value?: string | null | undefined;
  shape?: "square" | "wide" | undefined;
  onUploaded: (file: UploadOut) => void;
}) {
  const { progress, error, busy, inputRef, choose } = useUploadControl(
    purpose,
    sellerId,
    onUploaded,
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="type-label text-muted-foreground">{label}</p>
        {hint && <p className="type-caption mt-1">{hint}</p>}
      </div>

      <div
        className={cn(
          "grid place-items-center overflow-hidden border border-border bg-surface",
          shape === "square" ? "size-28" : "h-28 w-full max-w-md",
        )}
      >
        {value ? (
          // The stored file, not a local preview: what is shown is what buyers
          // will see, which is the only version worth confirming.
          <img
            src={value}
            alt={`${label} — hozirgi rasm`}
            className="size-full object-contain"
            loading="lazy"
          />
        ) : (
          <ImageUp className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>

      {progress !== null && <ProgressBar percent={progress} />}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={acceptFor(purpose)}
          aria-label={label}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so picking the same file again still fires a change.
            event.target.value = "";
            choose(file);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {busy ? `Yuklanmoqda… ${progress ?? 0}%` : value ? "Rasmni almashtirish" : "Rasm yuklash"}
        </Button>
        <span className="type-caption">JPEG, PNG yoki WEBP. Eng ko'pi 5 MB.</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/**
 * A paper sent in for the store-approval queue.
 *
 * These are stored privately: the URL alone does not open them, which is why
 * the list shows a name and a date instead of a thumbnail.
 */
export function DocumentUpload({
  sellerId,
  documents,
  onUploaded,
}: {
  sellerId: string;
  documents: UploadOut[];
  onUploaded: (file: UploadOut) => void;
}) {
  const { progress, error, busy, inputRef, choose } = useUploadControl(
    "SELLER_DOCUMENT",
    sellerId,
    onUploaded,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 border border-border bg-surface px-4 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        <p className="type-caption">
          Hujjatlar yopiq saqlanadi: ularni faqat siz va do'konni tekshirayotgan administrator ko'ra
          oladi. Guvohnoma, litsenziya yoki pasport nusxasini yuboring.
        </p>
      </div>

      {documents.length > 0 ? (
        <ul className="border border-border">
          {documents.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0"
            >
              {file.content_type === "application/pdf" ? (
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {file.original_filename}
              </span>
              <span className="type-caption whitespace-nowrap">
                {formatDate(file.created_at)} · {humanSize(file.size_bytes)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-caption">Hali hujjat yuborilmagan.</p>
      )}

      {progress !== null && <ProgressBar percent={progress} />}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={acceptFor("SELLER_DOCUMENT")}
          aria-label="Hujjat yuklash"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            choose(file);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {busy ? `Yuklanmoqda… ${progress ?? 0}%` : "Hujjat yuklash"}
        </Button>
        <span className="type-caption">PDF yoki rasm. Eng ko'pi 10 MB.</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
