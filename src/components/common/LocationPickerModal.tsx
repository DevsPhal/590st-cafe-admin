"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Compass, Loader2, MapPin, Navigation, Search, Store } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MapFocus } from "./LocationMapPicker";
import {
  isShortMapsLink,
  locateMe,
  parseCoordinates,
  reverseGeocode,
  searchPlaces,
  type LatLng,
  type PlaceResult,
} from "@/lib/geoSearch";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import { SHOP_LOCATION, isShopLocation } from "@/constants/shop";

const LocationMapPicker = dynamic(() => import("./LocationMapPicker"), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  const { t } = useI18n();
  return (
    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-gray-400">
      {t("map.loading", "Loading map...")}
    </div>
  );
}

const PHNOM_PENH = { lat: 11.5621, lng: 104.916 };
const PLACE_ZOOM = 17;

type Notice = { tone: "info" | "error"; text: string } | null;

// geoSearch is shared word-for-word with the customer site, so its English errors are translated here.
const LOCATION_ERROR_KEYS: Record<string, string> = {
  "Your location only works on a secure (https) page.": "map.location_insecure",
  "This browser can't share your location.": "map.location_unsupported",
  "Location is blocked. Allow location for this site in your browser settings, then try again.": "map.location_blocked",
  "Finding your location took too long. Move closer to a window or try again.": "map.location_timeout",
  "Your location isn't available right now. Turn on location services and try again.": "map.location_unavailable",
};

export function LocationPickerModal({
  open,
  onOpenChange,
  initialLat,
  initialLng,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLat: number | null;
  initialLng: number | null;
  onConfirm: (lat: number, lng: number) => void;
}) {
  const { t } = useI18n();
  const startAt = () =>
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : PHNOM_PENH;
  const [coords, setCoords] = useState<LatLng>(startAt);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCoords(startAt());
      setFocus(null);
      setAccuracy(null);
      setAddress("");
      setSearchQuery("");
      setResults([]);
      setNotice(null);
    }
  }

  const atShop = isShopLocation(coords.lat, coords.lng);

  const placePin = (point: LatLng, options: { fly?: boolean; label?: string } = {}) => {
    setCoords(point);
    if (options.fly) setFocus({ ...point, zoom: PLACE_ZOOM, key: Date.now() });
    if (options.label) setAddress(options.label);
    else void reverseGeocode(point).then(setAddress);
  };

  const handlePick = (lat: number, lng: number) => {
    setAccuracy(null);
    setResults([]);
    placePin({ lat, lng });
  };

  const handleLocateMe = async () => {
    setIsLocating(true);
    setNotice(null);
    setResults([]);
    try {
      const position = await locateMe();
      setAccuracy(position.accuracy);
      placePin(position, { fly: true });
      setNotice({
        tone: "info",
        text: t("map.pinned_current", "Pinned your current location (accurate to about {m} m).").replace(
          "{m}",
          String(Math.round(position.accuracy))
        ),
      });
    } catch (err) {
      const { message } = err as Error;
      const key = LOCATION_ERROR_KEYS[message];
      setNotice({ tone: "error", text: key ? t(key, message) : message });
    } finally {
      setIsLocating(false);
    }
  };

  const handleShopLocation = () => {
    setResults([]);
    setAccuracy(null);
    placePin({ lat: SHOP_LOCATION.lat, lng: SHOP_LOCATION.lng }, { fly: true, label: SHOP_LOCATION.name });
    setNotice({ tone: "info", text: t("map.pinned_shop", "Pinned the 590st Cafe Shop location.") });
  };

  const choosePlace = (place: PlaceResult) => {
    setResults([]);
    setAccuracy(null);
    setNotice(null);
    placePin(place, { fly: true, label: [place.name, place.detail].filter(Boolean).join(", ") });
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setNotice(null);
    setResults([]);

    const pasted = parseCoordinates(query);
    if (pasted) {
      setAccuracy(null);
      placePin(pasted, { fly: true });
      return;
    }
    if (isShortMapsLink(query)) {
      setNotice({
        tone: "error",
        text: t(
          "map.short_link",
          "Short Google Maps links can't be read here. Open the link, then copy the full address-bar link or the coordinates (e.g. 11.5621, 104.916)."
        ),
      });
      return;
    }

    setIsSearching(true);
    try {
      const found = await searchPlaces(query, coords);
      if (found.length === 0) {
        setNotice({
          tone: "error",
          text: t(
            "map.no_results",
            'No places found for "{query}". Try a street, area or landmark — or paste a Google Maps link or coordinates.'
          ).replace("{query}", query),
        });
      } else if (found.length === 1) {
        choosePlace(found[0]);
      } else {
        setResults(found);
      }
    } catch {
      setNotice({
        tone: "error",
        text: t("map.search_unavailable", "Search isn't reachable right now. Drag the pin or tap the map instead."),
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="admin_modal is_location_picker sm:max-w-[600px]"
        showCloseButton
      >
        <DialogHeader className="admin_modal_header">
          <DialogTitle className="admin_modal_title flex items-center gap-2">
            <MapPin className="h-4 w-4" /> {t("map.title", "Pin the Venue")}
          </DialogTitle>
        </DialogHeader>

        <div className="admin_modal_body space-y-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSearch();
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("map.search_placeholder", "Street, landmark, area, or paste a Google Maps link")}
                aria-label={t("map.search_label", "Search for a place")}
                enterKeyHint="search"
                className="h-10 w-full rounded-full border border-gray-200 bg-white pr-3 pl-9 text-base outline-none focus:border-[#7ec900] focus:ring-2 focus:ring-[#befe35]/40"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-(--brand-ink) bg-(--brand-ink) px-4 text-sm font-semibold text-(--ink-inverse) transition-colors hover:bg-(--brand-ink-hover) disabled:opacity-50 dark:border-(--line)"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("map.search", "Search")}
            </button>
          </form>

          {/* Theme tokens, not bg-black/text-black/gray-900: the dark theme remaps those to light shades. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={isLocating}
              className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full border border-(--brand-ink) bg-(--brand-ink) px-3 text-sm font-semibold text-(--brand-lime) transition-colors hover:bg-(--brand-ink-hover) disabled:opacity-50 dark:border-(--line)"
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{t("map.use_my_location", "Use my location")}</span>
            </button>
            <button
              type="button"
              onClick={handleShopLocation}
              aria-pressed={atShop}
              className={cn(
                "flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors",
                atShop
                  ? "border-(--brand-lime-strong) bg-(--brand-lime) text-(--brand-ink)"
                  : "border-(--ink-strong) bg-(--surface) text-(--ink-strong) hover:bg-(--surface-hover)"
              )}
            >
              <Store className="h-4 w-4 shrink-0" />
              <span className="truncate">{SHOP_LOCATION.name}</span>
            </button>
          </div>

          {results.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white" aria-label={t("map.search_results", "Search results")}>
              {results.map((place) => (
                <li key={place.id} className="border-b border-gray-100 last:border-0">
                  <button
                    type="button"
                    onClick={() => choosePlace(place)}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{place.name}</span>
                      {place.detail ? <span className="block truncate text-xs text-gray-500">{place.detail}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {notice ? (
            <p
              role={notice.tone === "error" ? "alert" : "status"}
              className={cn(
                "rounded-lg px-3 py-2 text-xs",
                notice.tone === "error" ? "bg-red-50 text-red-700" : "bg-lime-50 text-lime-800"
              )}
            >
              {notice.text}
            </p>
          ) : null}

          <div className="relative h-72 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100 sm:h-80">
            {open && (
              <LocationMapPicker
                lat={coords.lat}
                lng={coords.lng}
                onPick={handlePick}
                focus={focus}
                accuracy={accuracy}
              />
            )}
            <div className="pointer-events-none absolute top-3 left-3 z-[1000] flex items-center gap-1.5 rounded-full border border-white bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-800 shadow-md backdrop-blur-md">
              <Compass className="h-4 w-4 text-black" />
              <span className="tabular-nums">
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            {t("map.hint", "Drag the pin or tap the map to fine-tune. Scroll or pinch to zoom.")}
            {address ? (
              <span className="mt-1 block text-gray-700">{address}</span>
            ) : null}
          </p>
        </div>

        <DialogFooter className="admin_modal_footer">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn_outline_black"
          >
            {t("map.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(coords.lat, coords.lng);
              onOpenChange(false);
            }}
            className="btn_primary_yellow"
          >
            {t("map.confirm", "Use This Location")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
