/**
 * A seller's paper, fetched the only way it is allowed to be.
 *
 * The review payload carries a document's name, type and size but not its
 * location, on purpose: a passport behind a guessable link is a passport that
 * leaks. The address is resolved on demand through `/uploads/{id}`, which
 * checks who is asking and answers 404 — not 403 — to anyone who should not
 * even learn the file exists.
 *
 * The address is then offered as a link rather than opened automatically. A
 * window opened after an await is a pop-up as far as the browser is concerned,
 * and gets blocked; one extra click beats a button that silently does nothing.
 */
import { useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/avtoqism/panel/Widgets";
import { formatDate } from "@/lib/format";
import { useUploadDetail, type StoreDocumentOut } from "@/lib/query/admin";

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PrivateDocumentLink({
  document,
  lang,
}: {
  document: StoreDocumentOut;
  lang: "uz" | "ru";
}) {
  const [asked, setAsked] = useState(false);
  const upload = useUploadDetail(asked ? document.id : null);

  return (
    <li className="flex flex-wrap items-center gap-3 border border-border bg-card px-4 py-3">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{document.original_filename}</p>
        <p className="type-caption">
          {document.content_type} · {readableSize(document.size_bytes)} ·{" "}
          {formatDate(document.created_at, lang)}
        </p>
      </div>

      {upload.data ? (
        <a
          href={upload.data.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 border border-border-strong bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Hujjatni ochish
        </a>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={upload.isFetching}
          onClick={() => setAsked(true)}
        >
          {upload.isFetching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {upload.isFetching ? "Olinmoqda…" : "Manzilni olish"}
        </Button>
      )}

      {upload.isError && (
        <p role="alert" className="w-full text-xs text-destructive">
          {upload.error.message}
        </p>
      )}
    </li>
  );
}
