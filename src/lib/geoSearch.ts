// Place search, "use my location" and reverse geocoding for the map pickers.
// Kept identical in the admin dashboard and the customer site so both pickers behave the same.

export type LatLng = { lat: number; lng: number };
export type PlaceResult = LatLng & { id: string; name: string; detail: string };

const NOMINATIM = "https://nominatim.openstreetmap.org";
// Search the whole of Cambodia, but rank places near the current map view first.
const SEARCH_RADIUS_DEG = 0.35;

function inRange({ lat, lng }: LatLng) {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/**
 * Reads coordinates typed or pasted into the search box:
 * "11.5621, 104.916", or a full Google Maps link (…/@11.56,104.91,17z, ?q=11.56,104.91, !3d11.56!4d104.91).
 */
export function parseCoordinates(input: string): LatLng | null {
  const text = decodeURIComponent(input.trim());
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const point = { lat: Number(match[1]), lng: Number(match[2]) };
    if (inRange(point)) return point;
  }
  return null;
}

/** Short share links (maps.app.goo.gl) redirect server-side, so the browser can't read them. */
export function isShortMapsLink(input: string) {
  return /(?:maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(input);
}

type NominatimPlace = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  namedetails?: Record<string, string> | null;
  display_name: string;
};

export async function searchPlaces(query: string, near: LatLng, signal?: AbortSignal): Promise<PlaceResult[]> {
  const viewbox = [
    near.lng - SEARCH_RADIUS_DEG,
    near.lat + SEARCH_RADIUS_DEG,
    near.lng + SEARCH_RADIUS_DEG,
    near.lat - SEARCH_RADIUS_DEG,
  ].join(",");
  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    countrycodes: "kh",
    limit: "6",
    viewbox,
    bounded: "0",
    namedetails: "1",
    "accept-language": "en",
  });
  const res = await fetch(`${NOMINATIM}/search?${params}`, { signal });
  if (!res.ok) throw new Error("search failed");
  const data = (await res.json()) as NominatimPlace[];
  return data.map((place) => {
    const parts = place.display_name.split(",").map((part) => part.trim());
    // Many places carry a Khmer name plus an English one; show English when it exists.
    const names = place.namedetails ?? {};
    const name = names["name:en"] || names.name || place.name || parts[0];
    return {
      id: String(place.place_id),
      lat: Number(place.lat),
      lng: Number(place.lon),
      name,
      detail: parts.filter((part) => part !== name).slice(0, 3).join(", "),
    };
  });
}

export async function reverseGeocode({ lat, lng }: LatLng): Promise<string> {
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      zoom: "18",
      "accept-language": "en",
    });
    const res = await fetch(`${NOMINATIM}/reverse?${params}`);
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ? data.display_name.split(",").slice(0, 4).join(", ") : "";
  } catch {
    return "";
  }
}

/** Current device position, with a message a person can act on when it fails. */
export function locateMe(): Promise<LatLng & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      reject(new Error("Your location only works on a secure (https) page."));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("This browser can't share your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location is blocked. Allow location for this site in your browser settings, then try again."
            : error.code === error.TIMEOUT
              ? "Finding your location took too long. Move closer to a window or try again."
              : "Your location isn't available right now. Turn on location services and try again.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}
