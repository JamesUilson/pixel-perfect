/**
 * Local-only UI state.
 *
 * Everything that must survive a device change — garage, cart, orders, wishlist
 * server-side — now lives behind the API. What is left here is genuinely local:
 * which video the viewer liked before signing in, and which sellers they follow,
 * kept until those endpoints exist.
 *
 * Deliberately not a global store for server data: server state belongs to
 * TanStack Query, UI state belongs here, form state belongs to the form.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LocalState = {
  likes: string[];
  follows: string[];
};

const EMPTY: LocalState = { likes: [], follows: [] };
const KEY = "avtoqism.ui.v1";

type Ctx = LocalState & {
  hydrated: boolean;
  toggleLike: (id: string) => void;
  toggleFollow: (id: string) => void;
};

const UiStateContext = createContext<Ctx | null>(null);

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocalState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  // Read after mount so the server and the first client render agree.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...EMPTY, ...(JSON.parse(raw) as LocalState) });
    } catch {
      /* corrupt or blocked storage — start clean */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const toggle = useCallback((field: keyof LocalState, id: string) => {
    setState((s) => ({
      ...s,
      [field]: s[field].includes(id) ? s[field].filter((x) => x !== id) : [...s[field], id],
    }));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      hydrated,
      toggleLike: (id) => toggle("likes", id),
      toggleFollow: (id) => toggle("follows", id),
    }),
    [state, hydrated, toggle],
  );

  return <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>;
}

export function useUiState() {
  const ctx = useContext(UiStateContext);
  if (!ctx) throw new Error("useUiState must be used inside UiStateProvider");
  return ctx;
}
