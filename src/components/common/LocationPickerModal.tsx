"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Compass, Loader2, MapPin, Navigation, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// picker location map
const LocationMapPicker = dynamic(() => import("./LocationMapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-gray-400">
      Loading map...
    </div>
  ),
});

const PHNOM_PENH = { lat: 11.5621, lng: 104.916 };

/**
 * Staff-facing venue pin picker for the admin dashboard — search, "Locate Me", or drag/click
 * the pin directly, same interaction the customer app offers for a delivery address. Only
 * hands back coordinates on "Use This Location"; the caller decides what to do with them (the
 * event form keeps its own lat/lng inputs as the source of truth, this just fills them in).
 */
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
  const [coords, setCoords] = useState(
    initialLat != null && initialLng != null
      ? { lat: initialLat, lng: initialLng }
      : PHNOM_PENH,
  );
  const [address, setAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  // Re-seed from whatever the form currently holds each time the picker opens, so reopening it
  // starts from the last confirmed pin rather than wherever it was left mid-search.
  useEffect(() => {
    if (open) {
      setCoords(
        initialLat != null && initialLng != null
          ? { lat: initialLat, lng: initialLng }
          : PHNOM_PENH,
      );
      setAddress("");
      setSearchQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      );
      const data = await res.json();
      setAddress(
        data?.display_name
          ? data.display_name.split(",").slice(0, 4).join(", ")
          : "",
      );
    } catch {
      setAddress("");
    }
  };

  const handlePick = (lat: number, lng: number) => {
    setCoords({ lat, lng });
    void reverseGeocode(lat, lng);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePick(position.coords.latitude, position.coords.longitude);
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLocating(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(
          searchQuery + ", Cambodia",
        )}`,
      );
      const data = await res.json();
      const first = Array.isArray(data) ? data[0] : null;
      if (first) {
        handlePick(parseFloat(first.lat), parseFloat(first.lon));
      }
    } finally {
      setIsLocating(false);
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
            <MapPin className="h-4 w-4" /> Pin the Venue
          </DialogTitle>
        </DialogHeader>

        <div className="admin_modal_body space-y-3">
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search street, landmark, or area..."
                className="w-full rounded-full border border-gray-200 bg-white py-2 pr-3 pl-9 text-xs outline-none focus:border-[#befe35] sm:text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-full border-none bg-gray-800 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-gray-900"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={isLocating}
              className="flex items-center gap-1.5 rounded-full border-none bg-black px-3 py-2 text-xs font-semibold text-[#befe35] shadow-xs transition-all hover:bg-gray-900 disabled:opacity-50"
            >
              {isLocating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Navigation className="h-3.5 w-3.5" />
              )}
              <span>Locate Me</span>
            </button>
          </div>

          <div className="relative h-72 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100 sm:h-80">
            {open && (
              <LocationMapPicker
                lat={coords.lat}
                lng={coords.lng}
                onPick={handlePick}
              />
            )}
            <div className="pointer-events-none absolute top-3 left-3 z-[1000] flex items-center gap-1.5 rounded-full border border-white bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-800 shadow-md backdrop-blur-md">
              <Compass className="h-4 w-4 text-black" />
              <span>
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Drag the pin, tap anywhere on the map, or search above.
            {address ? (
              <span className="block text-gray-700">{address}</span>
            ) : null}
          </p>
        </div>

        <DialogFooter className="admin_modal_footer">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn_outline_black"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(coords.lat, coords.lng);
              onOpenChange(false);
            }}
            className="btn_primary_yellow"
          >
            Use This Location
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
