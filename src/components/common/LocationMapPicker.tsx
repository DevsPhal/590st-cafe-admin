"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";

const pinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** A place the map should move to (search result, "locate me"); bump `key` to move again. */
export type MapFocus = { lat: number; lng: number; zoom: number; key: number };

interface LocationMapPickerProps {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
  focus?: MapFocus | null;
  accuracy?: number | null;
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToFocus({ focus }: { focus?: MapFocus | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.6 });
  }, [focus, map]);
  return null;
}

// Leaflet measures its box once; inside a dialog that box is still animating, so re-measure.
function KeepSized() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const timer = window.setTimeout(() => map.invalidateSize(), 250);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

export default function LocationMapPicker({
  lat,
  lng,
  onPick,
  focus,
  accuracy,
}: LocationMapPickerProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      scrollWheelZoom
      zoomControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      {accuracy ? (
        <Circle
          center={[lat, lng]}
          radius={accuracy}
          pathOptions={{ color: "#3b82f6", weight: 1, fillOpacity: 0.12 }}
        />
      ) : null}
      <Marker
        position={[lat, lng]}
        icon={pinIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const position = (e.target as L.Marker).getLatLng();
            onPick(position.lat, position.lng);
          },
        }}
      />
      <ClickToPlace onPick={onPick} />
      <FlyToFocus focus={focus} />
      <KeepSized />
    </MapContainer>
  );
}
