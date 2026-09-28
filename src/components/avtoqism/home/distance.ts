/**
 * Distances as a person in Tashkent would say them.
 *
 * The API sends kilometres as a decimal string rounded to ten metres. Printing
 * that verbatim gives "0.24 km", which nobody says, so anything under a
 * kilometre is metres and anything over it is one decimal place.
 */
export function formatDistance(km: string | null | undefined): string | null {
  if (km == null) return null;
  const value = Number(km);
  if (!Number.isFinite(value) || value < 0) return null;
  if (value < 1) {
    // To the nearest ten metres; a GPS fix is not honest below that anyway.
    const metres = Math.max(10, Math.round((value * 1000) / 10) * 10);
    return `${metres} m`;
  }
  return `${value.toFixed(1)} km`;
}
