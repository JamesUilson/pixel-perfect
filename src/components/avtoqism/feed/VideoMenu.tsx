import { EyeOff, Flag, MoreHorizontal, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REPORT_REASONS, useNotInterested, useReportVideo, type FeedItem } from "@/lib/query/feed";
import { useIsAuthenticated } from "@/lib/query/session";
import { cn } from "@/lib/utils";

/**
 * The "…" control over a clip: share, "qiziq emas", and a report.
 *
 * Both destructive choices need an account — the server attributes them to a
 * person — so a signed-out visitor is told that rather than shown a button
 * that 401s.
 */
export function VideoMenu({
  item,
  onShare,
  className,
}: {
  item: FeedItem;
  onShare: () => void;
  className?: string | undefined;
}) {
  const signedIn = useIsAuthenticated();
  const notInterested = useNotInterested();
  const [reporting, setReporting] = useState(false);

  const hide = () => {
    if (!signedIn) {
      toast.error("Bu amal uchun tizimga kiring.");
      return;
    }
    notInterested.mutate(
      { videoId: item.video.id },
      {
        onSuccess: (data) =>
          toast.success(
            data.recorded
              ? "Bu video lentangizdan olib tashlandi."
              : "Bu video allaqachon yashirilgan edi.",
          ),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Bajarilmadi."),
      },
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Ko'proq amallar"
            className={cn("grid size-10 place-items-center text-foreground", className)}
          >
            <MoreHorizontal className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => onShare()}>
            <Send className="size-4" /> Ulashish
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => hide()}>
            <EyeOff className="size-4" /> Qiziq emas
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (!signedIn) {
                toast.error("Shikoyat qilish uchun tizimga kiring.");
                return;
              }
              setReporting(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Flag className="size-4" /> Shikoyat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportDialog videoId={item.video.id} open={reporting} onOpenChange={setReporting} />
    </>
  );
}

/**
 * The report form.
 *
 * The reasons are the API's own list and travel as codes; the Uzbek wording is
 * the label beside each one. "Boshqa sabab" is the only one where the free-text
 * box is the point, but it is offered for all of them because a moderator
 * reading "Spam" with a sentence attached closes the case faster.
 */
export function ReportDialog({
  videoId,
  open,
  onOpenChange,
}: {
  videoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const report = useReportVideo();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]?.code ?? "OTHER");
  const [detail, setDetail] = useState("");

  const submit = () => {
    report.mutate(
      { videoId, reasonCode: reason, detail: detail || undefined },
      {
        onSuccess: (data) => {
          toast.success(
            data.reported
              ? "Shikoyatingiz qabul qilindi. Moderatorlar ko'rib chiqadi."
              : "Siz bu videoga allaqachon shikoyat qilgansiz.",
          );
          setDetail("");
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Shikoyat yuborilmadi."),
      },
    );
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shikoyat qilish"
      className="fixed inset-0 z-[60] grid place-items-end bg-black/60 sm:place-items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className="max-h-[85dvh] w-full overflow-y-auto border border-border bg-background p-5 sm:max-w-md">
        <h2 className="type-h3">Nima uchun shikoyat qilyapsiz?</h2>
        <fieldset className="mt-4 space-y-1">
          <legend className="sr-only">Shikoyat sababi</legend>
          {REPORT_REASONS.map((entry) => (
            <label
              key={entry.code}
              className={cn(
                "flex cursor-pointer items-center gap-3 border border-transparent px-3 py-2.5 text-sm transition-colors",
                reason === entry.code
                  ? "border-primary bg-primary/5 font-semibold"
                  : "hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="report-reason"
                value={entry.code}
                checked={reason === entry.code}
                onChange={() => setReason(entry.code)}
                className="accent-primary"
              />
              {entry.label}
            </label>
          ))}
        </fieldset>

        <label className="mt-4 block text-sm font-semibold" htmlFor="report-detail">
          Qo'shimcha izoh
          <span className="ml-1 font-normal text-muted-foreground">(ixtiyoriy)</span>
        </label>
        <textarea
          id="report-detail"
          value={detail}
          onChange={(event) => setDetail(event.target.value.slice(0, 1000))}
          rows={3}
          className="mt-2 w-full resize-none border border-input bg-surface p-3 text-sm outline-none focus:border-primary"
          placeholder="Nima noto'g'ri ekanini yozing…"
        />

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 border border-border-strong px-4 py-3 text-sm font-semibold"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={report.isPending}
            className="flex-1 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {report.isPending ? "Yuborilmoqda…" : "Yuborish"}
          </button>
        </div>
      </div>
    </div>
  );
}
