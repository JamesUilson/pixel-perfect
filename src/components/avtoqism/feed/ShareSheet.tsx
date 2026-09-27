import { Bookmark, Flag, Heart, Instagram, Link2, QrCode as QrCodeIcon, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { QrCode } from "./QrCode";
import { videoLink } from "./util";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  useNotInterested,
  useShareVideo,
  type FeedItem,
  type ShareChannel,
} from "@/lib/query/feed";
import { cn } from "@/lib/utils";

type Props = {
  item: FeedItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onReport: () => void;
};

/** Copy text without assuming the async clipboard exists — it needs a secure origin. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(field);
    return copied;
  } catch {
    return false;
  }
}

/**
 * The share sheet.
 *
 * Every route out of here posts `POST /videos/{id}/share` with its own channel,
 * including the copied link and the QR code, so the creator's statistics say
 * where their clips actually travel instead of counting only the taps that
 * happened to open another app.
 *
 * Instagram is the one channel with no share URL to open — it accepts no
 * arbitrary link from the web — so it copies the link and opens Instagram,
 * which is the honest version of what the button promises.
 */
export function ShareSheet({ item, open, onOpenChange, onSave, onReport }: Props) {
  const share = useShareVideo();
  const notInterested = useNotInterested();
  const [showQr, setShowQr] = useState(false);

  const link = videoLink(item.video.id);
  const caption = item.video.caption?.trim() || item.seller?.store_name || "AVTOQISM";

  const record = (channel: ShareChannel) => {
    share.mutate(
      { videoId: item.video.id, channel },
      { onError: () => toast.error("Ulashishni qayd etib bo'lmadi.") },
    );
  };

  const openExternal = (url: string, channel: ShareChannel) => {
    record(channel);
    window.open(url, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  const channels: Array<{
    key: string;
    label: string;
    icon: ComponentType<{ className?: string | undefined }>;
    tone: string;
    onClick: () => void;
  }> = [
    {
      key: "telegram",
      label: "Telegram",
      icon: TelegramGlyph,
      tone: "bg-viz-2 text-primary-foreground",
      onClick: () =>
        openExternal(
          `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(caption)}`,
          "TELEGRAM",
        ),
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: WhatsAppGlyph,
      tone: "bg-viz-3 text-primary-foreground",
      onClick: () =>
        openExternal(`https://wa.me/?text=${encodeURIComponent(`${caption} ${link}`)}`, "WHATSAPP"),
    },
    {
      key: "instagram",
      label: "Instagram",
      icon: Instagram,
      tone: "bg-gradient-to-br from-viz-4 via-viz-1 to-viz-5 text-primary-foreground",
      onClick: () => {
        void copyText(link).then((copied) => {
          toast[copied ? "success" : "error"](
            copied
              ? "Havola nusxalandi — Instagram'ga joylashtiring."
              : "Havolani nusxalab bo'lmadi.",
          );
        });
        openExternal("https://www.instagram.com/", "INSTAGRAM");
      },
    },
    {
      key: "link",
      label: "Link nusxasi",
      icon: Link2,
      tone: "bg-muted text-foreground",
      onClick: () => {
        void copyText(link).then((copied) => {
          if (!copied) {
            toast.error("Havolani nusxalab bo'lmadi.");
            return;
          }
          record("LINK");
          toast.success("Havola nusxalandi.");
          onOpenChange(false);
        });
      },
    },
  ];

  const actions: Array<{ key: string; label: string; icon: LucideIcon; onClick: () => void }> = [
    {
      key: "report",
      label: "Report",
      icon: Flag,
      onClick: () => {
        onOpenChange(false);
        onReport();
      },
    },
    {
      key: "not-interested",
      label: "Qiziq emas",
      icon: Heart,
      onClick: () => {
        notInterested.mutate(
          { videoId: item.video.id },
          {
            onSuccess: () => toast.success("Bu video lentangizdan olib tashlandi."),
            onError: (error) =>
              toast.error(error instanceof Error ? error.message : "Bajarilmadi."),
          },
        );
        onOpenChange(false);
      },
    },
    {
      key: "save",
      label: "Saqlash",
      icon: Bookmark,
      onClick: () => {
        onSave();
        onOpenChange(false);
      },
    },
    {
      key: "qr",
      label: "QR kod",
      icon: QrCodeIcon,
      onClick: () => {
        setShowQr((current) => {
          // Rendering the code is itself a share: it exists to be scanned.
          if (!current) record("QR");
          return !current;
        });
      },
    },
  ];

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) setShowQr(false);
        onOpenChange(next);
      }}
    >
      <DrawerContent className="max-h-[85dvh] pb-[env(safe-area-inset-bottom)]">
        <div className="relative px-5 pb-6 pt-4">
          <DrawerTitle className="text-center text-base font-semibold">Ulashish</DrawerTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Yopish"
            className="absolute right-4 top-3 grid size-8 place-items-center text-muted-foreground"
          >
            <X className="size-5" />
          </button>

          <div className="mt-5 grid grid-cols-4 gap-2 border-t border-border pt-6">
            {channels.map(({ key, label, icon: Icon, tone, onClick }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                className="flex flex-col items-center gap-2 text-xs font-medium"
              >
                <span className={cn("grid size-14 place-items-center rounded-full", tone)}>
                  <Icon className="size-7" />
                </span>
                <span className="text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-4 gap-2 border-t border-border pt-6">
            {actions.map(({ key, label, icon: Icon, onClick }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                aria-pressed={key === "qr" ? showQr : undefined}
                className="flex flex-col items-center gap-2 text-xs font-medium"
              >
                <span
                  className={cn(
                    "grid size-14 place-items-center rounded-full bg-muted",
                    key === "qr" && showQr && "ring-2 ring-primary",
                  )}
                >
                  <Icon className="size-6" />
                </span>
                <span className="text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {showQr && (
            <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-6">
              <div className="size-48 bg-white p-2">
                <QrCode value={link} title="Video havolasi uchun QR kod" />
              </div>
              <p className="type-caption max-w-xs break-all text-center">{link}</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Lucide ships no brand marks for these two, so the glyphs are drawn here. */
function TelegramGlyph({ className }: { className?: string | undefined }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M21.6 4.3 2.9 11.5c-.9.35-.86 1.63.05 1.93l4.72 1.55 1.8 5.48c.24.72 1.17.9 1.66.32l2.5-2.94 4.7 3.45c.6.44 1.45.11 1.6-.62l3-14.1c.17-.8-.6-1.48-1.33-1.17ZM8.9 14.2l9-5.6-7.5 6.9-.3 3.2-1.2-4.5Z" />
    </svg>
  );
}

function WhatsAppGlyph({ className }: { className?: string | undefined }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2a10 10 0 0 0-8.6 15.05L2 22l5.1-1.33A10 10 0 1 0 12 2Zm0 18.1a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.03.79.81-2.95-.2-.31A8.1 8.1 0 1 1 12 20.1Zm4.46-6.02c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.25-.63.8-.77.96-.14.16-.28.18-.52.06a6.63 6.63 0 0 1-1.95-1.2 7.3 7.3 0 0 1-1.35-1.68c-.14-.24-.02-.37.1-.49.11-.11.25-.28.37-.43.12-.14.16-.25.24-.41.08-.16.04-.3-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.47-.4-.4-.55-.41h-.47c-.16 0-.43.06-.65.3-.22.25-.85.84-.85 2.04s.87 2.37.99 2.53c.12.16 1.71 2.62 4.15 3.67.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}
