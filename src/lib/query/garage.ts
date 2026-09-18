import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { safeApi } from "@/lib/api/client";
import { useIsAuthenticated } from "./session";
import type { BrandOut, GarageVehicleOut, ModelOut, VariantOut } from "@/lib/api/types";
import { qk } from "./keys";

export function useGarage() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.garage,
    queryFn: () => safeApi<GarageVehicleOut[]>("/garage/vehicles"),
    enabled: signedIn,
    staleTime: 60_000,
  });
}

/** The active car. Everything personalised in the app reads this one value. */
export function useActiveVehicle() {
  const garage = useGarage();
  const active = garage.data?.find((v) => v.is_primary) ?? garage.data?.[0] ?? null;
  return { ...garage, activeVehicle: active, variantId: active?.variant.id ?? null };
}

export function useVehicleBrands() {
  return useQuery({
    queryKey: qk.vehicleBrands,
    queryFn: () => safeApi<BrandOut[]>("/vehicles/brands"),
    staleTime: 60 * 60_000,
  });
}

export function useVehicleModels(brandSlug: string | null) {
  return useQuery({
    queryKey: qk.vehicleModels(brandSlug ?? ""),
    queryFn: () => safeApi<ModelOut[]>(`/vehicles/brands/${brandSlug}/models`),
    enabled: Boolean(brandSlug),
    staleTime: 60 * 60_000,
  });
}

export function useVehicleYears(modelId: string | null) {
  return useQuery({
    queryKey: qk.vehicleYears(modelId ?? ""),
    queryFn: () => safeApi<number[]>(`/vehicles/models/${modelId}/years`),
    enabled: Boolean(modelId),
    staleTime: 60 * 60_000,
  });
}

export function useVehicleVariants(modelId: string | null, year: number | null) {
  return useQuery({
    queryKey: qk.vehicleVariants(modelId ?? "", year ?? undefined),
    queryFn: () =>
      safeApi<VariantOut[]>(`/vehicles/models/${modelId}/variants`, {
        query: year ? { year } : undefined,
      }),
    enabled: Boolean(modelId),
    staleTime: 60 * 60_000,
  });
}

function invalidatePersonalised(queryClient: ReturnType<typeof useQueryClient>) {
  // Changing the car changes the home grid, search results and every fitment
  // badge, so those caches go with it.
  void queryClient.invalidateQueries({ queryKey: qk.garage });
  void queryClient.invalidateQueries({ queryKey: ["products"] });
  void queryClient.invalidateQueries({ queryKey: ["product"] });
  void queryClient.invalidateQueries({ queryKey: qk.cart });
}

export function useAddVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      variant_id: string;
      year: number;
      plate_number?: string | null;
      color?: string | null;
      vin?: string | null;
      mileage_km?: number | null;
      make_primary?: boolean;
    }) => safeApi<GarageVehicleOut>("/garage/vehicles", { method: "POST", body: input }),
    onSuccess: () => invalidatePersonalised(queryClient),
  });
}

export function useSetPrimaryVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vehicleId: string) =>
      safeApi<GarageVehicleOut>(`/garage/vehicles/${vehicleId}/primary`, { method: "POST" }),
    onSuccess: () => invalidatePersonalised(queryClient),
  });
}

export function useRemoveVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vehicleId: string) =>
      safeApi<void>(`/garage/vehicles/${vehicleId}`, { method: "DELETE" }),
    onSuccess: () => invalidatePersonalised(queryClient),
  });
}
