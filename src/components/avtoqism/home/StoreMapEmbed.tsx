/**
 * Every nearby shop on one map, with no SDK and no API key.
 *
 * The pattern is the one `panel/LocationPicker` and `delivery/MapPointPicker`
 * already use: Yandex serves a map widget in an iframe that anybody may embed.
 * Its `pt` parameter takes a list of points separated by `~`, so one URL draws
 * the whole set — this is the only Yandex URL the client builds, and it builds
 * it because an embed has no server-side counterpart. Every link a person can
 * actually follow still comes from the API's own `pin_url`.
 *
 * The list under the map is not a fallback bolted on: the widget is a picture,
 * nothing can be read back out of it, and a pin cannot be tapped through to a
 * shop page. So the map orients and the list is what is used — which also means
 * the section stays entirely usable if the embed is blocked, offline, or draws
 * fewer pins than it was given.
 */
import type { StoreMap } from "@/lib/query/discovery";

/**
 * How many pins go into the URL.
 *
 * The API caps a map payload at two hundred. Two hundred points is roughly
 * five kilobytes of query string, which is past what some proxies will carry,
 * and past what is legible at city zoom in any case. The nearest forty is a
 * map; the rest is a texture.
 */
const MAX_PINS = 40;

/** `pm2rdm` is Yandex's small red dot — the same marker the pickers use. */
function widgetSrc(map: StoreMap): string {
  const points = map.pins
    .slice(0, MAX_PINS)
    .map((pin) => `${pin.longitude},${pin.latitude},pm2rdm`)
    .join("~");
  const centre = `${map.center.longitude},${map.center.latitude}`;
  // Zoom 12 is about a third of Tashkent: close enough to tell districts apart,
  // wide enough that a ten-kilometre radius fits without panning.
  const base = `https://yandex.uz/map-widget/v1/?ll=${centre}&z=12`;
  return points ? `${base}&pt=${encodeURIComponent(points)}` : base;
}

export function StoreMapEmbed({ map }: { map: StoreMap }) {
  const shown = Math.min(map.pins.length, MAX_PINS);
  const src = widgetSrc(map);

  return (
    <div className="border border-border bg-muted">
      <iframe
        // Yandex reloads on a src change only when the element is replaced.
        key={src}
        src={src}
        title="Yaqin atrofdagi do'konlar xaritasi"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-64 w-full border-0 sm:h-80 lg:h-96"
      />
      <p className="type-caption border-t border-border px-4 py-3">
        {map.pins.length === 0
          ? "Bu radiusda xaritaga joylashgan do'kon topilmadi."
          : shown < map.pins.length
            ? `Xaritada eng yaqin ${shown} ta do'kon ko'rsatilgan (jami ${map.pins.length} ta).`
            : `Xaritada ${shown} ta do'kon. Do'kon sahifasini ochish uchun quyidagi ro'yxatdan foydalaning.`}
      </p>
    </div>
  );
}
