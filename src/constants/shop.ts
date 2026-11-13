export const SHOP_LOCATION = {
  name: "590st Cafe Shop",
  lat: 11.574950080287184,
  lng: 104.8956205961827,
} as const;

// Saved coordinates are rounded to 6 decimals, so compare with a small tolerance.
export function isShopLocation(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return false;
  return Math.abs(lat - SHOP_LOCATION.lat) < 1e-5 && Math.abs(lng - SHOP_LOCATION.lng) < 1e-5;
}
