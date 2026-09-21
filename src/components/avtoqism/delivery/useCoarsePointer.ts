import { useEffect, useState } from "react";

/**
 * Is this a finger, rather than a mouse?
 *
 * It decides whether the `yandexnavi://` deep link is worth offering: on a
 * laptop it can only ever fail, and a dead button next to a working one reads
 * as a broken page. Starts false so the server and the first client render
 * agree, then corrects itself — the browser link beside it works either way.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return coarse;
}
