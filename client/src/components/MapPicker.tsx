import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
const icon = L.divIcon({
  className: "custom-map-marker",
  html: "<span></span>",
  iconSize: [28, 36],
  iconAnchor: [14, 33],
});
function Events({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const p = (e.target as L.Marker).getLatLng();
          onChange(p.lat, p.lng);
        },
      }}
    />
  );
}
export default function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  return (
    <div className="map-picker">
      <MapContainer
        center={[lat, lng]}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Events lat={lat} lng={lng} onChange={onChange} />
      </MapContainer>
      <span className="map-hint">Click the map or drag the pin to adjust</span>
    </div>
  );
}
