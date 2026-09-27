import { useMemo } from "react";

import { qrMatrix } from "./qr";
import { cn } from "@/lib/utils";

/**
 * A QR code as inline SVG.
 *
 * One `<path>` of little squares rather than a grid of `<rect>`s: a version-4
 * symbol is nearly a thousand modules, and a thousand elements is a thousand
 * layout boxes for something that never changes.
 *
 * The quiet zone is part of the drawing. Without four modules of margin a
 * scanner cannot find the symbol, and a code printed flush against a card edge
 * is a code that does not work.
 */
export function QrCode({
  value,
  className,
  title = "QR kod",
}: {
  value: string;
  className?: string | undefined;
  title?: string | undefined;
}) {
  const drawing = useMemo(() => {
    try {
      const modules = qrMatrix(value, "M");
      const quiet = 4;
      const size = modules.length + quiet * 2;
      const path = modules
        .flatMap((row, y) =>
          row.map((dark, x) => (dark ? `M${x + quiet} ${y + quiet}h1v1h-1z` : "")),
        )
        .join("");
      return { size, path };
    } catch {
      return null;
    }
  }, [value]);

  if (!drawing) {
    return (
      <p className={cn("type-caption text-center", className)}>
        Bu havola uchun QR kod yaratib bo'lmadi.
      </p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${drawing.size} ${drawing.size}`}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      className={cn("size-full", className)}
    >
      {/*
        Black on white, spelled out rather than themed. A QR code is read by a
        camera looking for maximum contrast, so it stays the same in both
        themes — a token that follows dark mode would make it unscannable — and
        the quiet zone has to be light whatever sits behind the sheet.
      */}
      <rect width={drawing.size} height={drawing.size} fill="#ffffff" />
      <path d={drawing.path} fill="#000000" />
    </svg>
  );
}
