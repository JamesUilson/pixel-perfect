import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getProduct } from "@/data/demo";

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  year: number;
  engine: string;
  transmission: string;
  vin?: string;
};

export type CartLine = { productId: string; sellerId: string; qty: number };

export type OrderStatus = "new" | "packed" | "shipped" | "delivered";

export type Order = {
  id: string;
  createdAt: string;
  lines: CartLine[];
  total: number;
  status: OrderStatus;
  recipient: string;
  address: string;
  payment: "cash" | "card";
};

type State = {
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  cart: CartLine[];
  wishlist: string[];
  likes: string[];
  follows: string[];
  orders: Order[];
};

const initialState: State = {
  vehicles: [],
  activeVehicleId: null,
  cart: [],
  wishlist: [],
  likes: [],
  follows: [],
  orders: [],
};

const seedState: State = {
  ...initialState,
  vehicles: [
    {
      id: "seed-cobalt",
      brand: "Chevrolet",
      model: "Cobalt",
      year: 2023,
      engine: "1.5",
      transmission: "Avtomat",
    },
  ],
  activeVehicleId: "seed-cobalt",
};

type Ctx = State & {
  hydrated: boolean;
  activeVehicle: Vehicle | null;
  addVehicle: (v: Omit<Vehicle, "id">) => string;
  removeVehicle: (id: string) => void;
  setActiveVehicle: (id: string) => void;
  addToCart: (productId: string, sellerId: string, qty?: number) => void;
  setQty: (productId: string, sellerId: string, qty: number) => void;
  removeFromCart: (productId: string, sellerId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  toggleWishlist: (id: string) => void;
  toggleLike: (id: string) => void;
  toggleFollow: (id: string) => void;
  placeOrder: (data: { recipient: string; address: string; payment: "cash" | "card" }) => string;
  advanceOrder: (id: string) => void;
};

const StoreContext = createContext<Ctx | null>(null);
const KEY = "motora.state.v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(seedState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...seedState, ...(JSON.parse(raw) as State) });
    } catch {
      /* ignore corrupt state */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const update = useCallback((fn: (s: State) => State) => setState((s) => fn(s)), []);

  const value = useMemo<Ctx>(() => {
    const cartTotal = state.cart.reduce((sum, line) => {
      const product = getProduct(line.productId);
      const offer = product?.offers.find((o) => o.sellerId === line.sellerId);
      return sum + (offer?.price ?? product?.price ?? 0) * line.qty;
    }, 0);

    return {
      ...state,
      hydrated,
      activeVehicle: state.vehicles.find((v) => v.id === state.activeVehicleId) ?? null,
      cartCount: state.cart.reduce((n, l) => n + l.qty, 0),
      cartTotal,
      addVehicle: (v) => {
        const id = `v-${Date.now()}`;
        update((s) => ({ ...s, vehicles: [...s.vehicles, { ...v, id }], activeVehicleId: id }));
        return id;
      },
      removeVehicle: (id) =>
        update((s) => {
          const vehicles = s.vehicles.filter((v) => v.id !== id);
          return {
            ...s,
            vehicles,
            activeVehicleId: s.activeVehicleId === id ? (vehicles[0]?.id ?? null) : s.activeVehicleId,
          };
        }),
      setActiveVehicle: (id) => update((s) => ({ ...s, activeVehicleId: id })),
      addToCart: (productId, sellerId, qty = 1) =>
        update((s) => {
          const existing = s.cart.find((l) => l.productId === productId && l.sellerId === sellerId);
          return {
            ...s,
            cart: existing
              ? s.cart.map((l) => (l === existing ? { ...l, qty: l.qty + qty } : l))
              : [...s.cart, { productId, sellerId, qty }],
          };
        }),
      setQty: (productId, sellerId, qty) =>
        update((s) => ({
          ...s,
          cart: s.cart
            .map((l) => (l.productId === productId && l.sellerId === sellerId ? { ...l, qty } : l))
            .filter((l) => l.qty > 0),
        })),
      removeFromCart: (productId, sellerId) =>
        update((s) => ({
          ...s,
          cart: s.cart.filter((l) => !(l.productId === productId && l.sellerId === sellerId)),
        })),
      clearCart: () => update((s) => ({ ...s, cart: [] })),
      toggleWishlist: (id) =>
        update((s) => ({
          ...s,
          wishlist: s.wishlist.includes(id)
            ? s.wishlist.filter((x) => x !== id)
            : [...s.wishlist, id],
        })),
      toggleLike: (id) =>
        update((s) => ({
          ...s,
          likes: s.likes.includes(id) ? s.likes.filter((x) => x !== id) : [...s.likes, id],
        })),
      toggleFollow: (id) =>
        update((s) => ({
          ...s,
          follows: s.follows.includes(id) ? s.follows.filter((x) => x !== id) : [...s.follows, id],
        })),
      placeOrder: ({ recipient, address, payment }) => {
        const id = `UZ-${Math.floor(100000 + Math.random() * 899999)}`;
        update((s) => ({
          ...s,
          orders: [
            {
              id,
              createdAt: new Date().toISOString(),
              lines: s.cart,
              total: cartTotal,
              status: "new",
              recipient,
              address,
              payment,
            },
            ...s.orders,
          ],
          cart: [],
        }));
        return id;
      },
      advanceOrder: (id) =>
        update((s) => ({
          ...s,
          orders: s.orders.map((o) => {
            if (o.id !== id) return o;
            const flow: OrderStatus[] = ["new", "packed", "shipped", "delivered"];
            const next = flow[Math.min(flow.indexOf(o.status) + 1, flow.length - 1)];
            return { ...o, status: next };
          }),
        })),
    };
  }, [state, hydrated, update]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function fitmentFor(fitsModels: string[], vehicleModel?: string | null) {
  if (!vehicleModel) return "unknown" as const;
  return fitsModels.includes(vehicleModel) ? ("fit" as const) : ("nofit" as const);
}
