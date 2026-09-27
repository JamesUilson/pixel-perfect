/**
 * What a clip's two status fields mean, in the seller's words.
 *
 * A video is visible in the feed only when three independent things are true:
 * the file is ready, a moderator has approved it, and its owner has published
 * it. The server derives `is_public` from all three and lists whatever is still
 * missing in `pending`, so nothing here re-derives visibility — these maps only
 * name the states, and the seller is shown the server's own sentences.
 */
import type { VideoModerationStatus, VideoStatus } from "@/lib/query/seller";

type Tone = "neutral" | "good" | "warning" | "critical" | "info";

export const VIDEO_STATUS_UZ: Record<VideoStatus, { label: string; tone: Tone }> = {
  UPLOADING: { label: "Yuklanmoqda", tone: "neutral" },
  PROCESSING: { label: "Qayta ishlanmoqda", tone: "warning" },
  READY: { label: "Fayl tayyor", tone: "good" },
  FAILED: { label: "Xatolik", tone: "critical" },
  REMOVED: { label: "O'chirilgan", tone: "neutral" },
};

export const MODERATION_UZ: Record<VideoModerationStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Ko'rib chiqilmoqda", tone: "warning" },
  UNDER_REVIEW: { label: "Tekshiruvda", tone: "warning" },
  APPROVED: { label: "Tasdiqlangan", tone: "good" },
  REJECTED: { label: "Rad etilgan", tone: "critical" },
  REMOVED: { label: "Olib tashlangan", tone: "critical" },
};

/**
 * The sentence under the badge.
 *
 * "Ko'rib chiqilmoqda" is the state sellers misread most often — it looks like
 * the clip is live and merely being watched — so it says outright that nobody
 * sees the video until a moderator approves it.
 */
export function moderationMeaning(status: VideoModerationStatus): string {
  switch (status) {
    case "PENDING":
    case "UNDER_REVIEW":
      return "Video administrator tasdiqlagunicha lentada ko'rinmaydi. Tekshiruv odatda bir ish kunida tugaydi.";
    case "APPROVED":
      return "Administrator tasdiqlagan. E'lon qilingan bo'lsa, lentada ko'rinadi.";
    case "REJECTED":
      // The reason exists only in the audit log, so promising one here would be
      // a promise the API cannot keep.
      return "Administrator videoni rad etgan. Sababi panelda ko'rsatilmaydi — qo'llab-quvvatlash xizmatiga murojaat qiling.";
    case "REMOVED":
      return "Administrator videoni lentadan olib tashlagan.";
  }
}

/** Anything the seller can still do about this clip's file. */
export function isEditable(status: VideoStatus): boolean {
  return status !== "REMOVED";
}
