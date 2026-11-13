"use client";

import { useCurrentRole } from "@/store/api/useCurrentRole";
import { useGetBaristaExchangeRateQuery, useGetExchangeRateQuery } from "@/store/api/reportApi";

/** USD-to-KHR rate for whoever is signed in: admins and baristas read it from their own endpoint. */
export function useExchangeRate() {
  const { isAdmin, isBarista } = useCurrentRole();
  const admin = useGetExchangeRateQuery(undefined, { skip: !isAdmin });
  const barista = useGetBaristaExchangeRateQuery(undefined, { skip: !isBarista });
  const data = isAdmin ? admin.data : barista.data;
  return {
    exchangeRate: data,
    khrPerUsdRate: data ? Number(data.khrPerUsdRate) : null,
  };
}
