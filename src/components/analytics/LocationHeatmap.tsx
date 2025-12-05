import React, { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, useMap, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { MapPin } from "lucide-react";
import type { Response } from "../../types";

interface LocationData {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  region?: string;
  count?: number;
}

interface LocationStats {
  totalLocations: number;
  topCities: Array<{ city: string; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
  avgLatitude: number;
  avgLongitude: number;
}

interface HeatmapLayerProps {
  data: [number, number, number][]; // [lat, lng, intensity]
}

interface MarkerLayerProps {
  locations: LocationData[];
}

const createCustomIcon = (count: number) => {
  const iconSize = Math.max(30, Math.min(50, count * 5));
  const html = `
    <div style="
      
      width: ${iconSize}px;
      height: 300;
    ">
      <div style="
    
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #3b82f6, #1e40af);
        border: 3px solid #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 12px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      ">
        ${count}
      </div>
      <div style="
       
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 10px solid #1e40af;
      "></div>
    </div>
  `;
  
  return L.divIcon({
    html,
    iconSize: [iconSize, iconSize + 15],
    iconAnchor: [iconSize / 2, iconSize + 15],
    popupAnchor: [0, -iconSize],
    className: "location-marker",
  });
};

const HeatmapLayer = ({ data }: HeatmapLayerProps) => {
  const map = useMap();

  useEffect(() => {
    if (data.length === 0) return;

    const heatLayer = (L as any).heatLayer(data, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      minOpacity: 0.3,
      gradient: {
        0.0: "#0000ff",
        0.25: "#00ff00",
        0.5: "#ffff00",
        0.75: "#ff8800",
        1.0: "#ff0000",
      },
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, data]);

  return null;
};

const TextLabelsLayer = ({ locations }: MarkerLayerProps) => {
  const map = useMap();

  useEffect(() => {
    locations.forEach((location) => {
      const labelHtml = `
        <div style="
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.9));
          padding: 4px 8px;
          border-radius: 4px;
          border: 2px solid #3b82f6;
          font-weight: bold;
          font-size: 11px;
          color: #1e40af;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          backdrop-filter: blur(4px);
        ">
          ${location.city || location.country || 'Unknown'} (${location.count || 1})
        </div>
      `;

      const icon = L.divIcon({
        html: labelHtml,
        iconSize: [120, 30],
        iconAnchor: [60, 0],
        className: "text-label",
      });

      L.marker([location.latitude, location.longitude], { icon })
        .bindPopup(`
          <div style="font-family: system-ui, -apple-system, sans-serif;">
            <div style="font-weight: bold; color: #3b82f6; margin-bottom: 8px; font-size: 14px;">
              📍 ${location.count || 1} Response${(location.count || 1) > 1 ? "s" : ""}
            </div>
            ${location.city ? `<div style="font-size: 12px; margin: 4px 0;"><strong>City:</strong> ${location.city}</div>` : ""}
            ${location.region ? `<div style="font-size: 12px; margin: 4px 0;"><strong>Region:</strong> ${location.region}</div>` : ""}
            ${location.country ? `<div style="font-size: 12px; margin: 4px 0;"><strong>Country:</strong> ${location.country}</div>` : ""}
          </div>
        `)
        .addTo(map);
    });
  }, [map, locations]);

  return null;
};

const MarkerLayer = ({ locations }: MarkerLayerProps) => {
  return (
    <>
      {locations.map((location, idx) => (
        <Marker
          key={idx}
          position={[location.latitude, location.longitude]}
          icon={createCustomIcon(location.count || 1)}
        >
          <Popup>
            <div className="min-w-max" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
              <div className="font-bold text-blue-600 text-sm mb-1">
                📍 {location.count || 1} Response{(location.count || 1) > 1 ? "s" : ""}
              </div>
              {location.city && (
                <div className="text-sm text-gray-800">
                  <span className="font-semibold">City:</span> {location.city}
                </div>
              )}
              {location.region && (
                <div className="text-sm text-gray-800">
                  <span className="font-semibold">Region:</span> {location.region}
                </div>
              )}
              {location.country && (
                <div className="text-sm text-gray-800">
                  <span className="font-semibold">Country:</span> {location.country}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
      <TextLabelsLayer locations={locations} />
    </>
  );
};

interface LocationHeatmapProps {
  responses: Response[];
  title?: string;
  id?: string;

}

export default function LocationHeatmap({
  responses,
  title = "Response Locations",
  id
}: LocationHeatmapProps) {
  const mapRef = useRef(null);

  const { heatmapData, locationStats, markerLocations } = useMemo(() => {
    const allLocations: LocationData[] = [];
    const cityMap: Record<string, { lat: number; lng: number; count: number; region?: string; country?: string }> = {};
    const countryMap: Record<string, number> = {};
    let totalLat = 0;
    let totalLng = 0;

    responses.forEach((response) => {
      let lat: number | undefined;
      let lng: number | undefined;
      let city: string | undefined;
      let country: string | undefined;
      let region: string | undefined;

      if (response.submissionMetadata?.capturedLocation) {
        const { latitude, longitude } = response.submissionMetadata.capturedLocation;
        if (latitude !== undefined && longitude !== undefined) {
          lat = latitude;
          lng = longitude;
        }
      }

      if (
        !lat ||
        !lng ||
        isNaN(lat) ||
        isNaN(lng)
      ) {
        if (response.submissionMetadata?.location) {
          const { latitude, longitude, city: locCity, country: locCountry, region: locRegion } =
            response.submissionMetadata.location;
          if (latitude !== undefined && longitude !== undefined) {
            lat = latitude;
            lng = longitude;
          }
          city = locCity;
          country = locCountry;
          region = locRegion;
        }
      }

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        allLocations.push({ latitude: lat, longitude: lng, city, country, region });
        totalLat += lat;
        totalLng += lng;

        const locationKey = city && country ? `${city}, ${country}` : country || "Unknown";
        
        if (locationKey !== "Unknown") {
          if (!cityMap[locationKey]) {
            cityMap[locationKey] = { lat, lng, count: 0, region, country };
          }
          cityMap[locationKey].count += 1;
        }

        if (country) {
          countryMap[country] = (countryMap[country] || 0) + 1;
        }
      }
    });

    const heatmapData: [number, number, number][] = allLocations.map(
      (loc) => [loc.latitude, loc.longitude, 1]
    );

    const markerData: LocationData[] = Object.entries(cityMap)
      .map(([name, data]) => ({
        latitude: data.lat,
        longitude: data.lng,
        city: name.split(",")[0],
        country: data.country,
        region: data.region,
        count: data.count,
      }));

    const topCities = Object.entries(cityMap)
      .map(([name, data]) => ({ city: name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topCountries = Object.entries(countryMap)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const locationStats: LocationStats = {
      totalLocations: allLocations.length,
      topCities,
      topCountries,
      avgLatitude: allLocations.length > 0 ? totalLat / allLocations.length : 0,
      avgLongitude: allLocations.length > 0 ? totalLng / allLocations.length : 0,
    };

    return { heatmapData, locationStats, markerLocations: markerData };
  }, [responses]);

   const mapCenter: [number, number] =
    locationStats.totalLocations > 0
      ? [locationStats.avgLatitude, locationStats.avgLongitude]
      : [20, 0];

  return (
    <div id={id}>
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-600">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
        <h3 className="text-md font-semibold text-gray-900 dark:text-white flex items-center">
          <MapPin className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
          {title}
        </h3>
      </div>

      {/* Main Content with Reduced Padding */}
      <div className="p-4">
        {/* Map Section - Reduced Height */}
        {locationStats.totalLocations > 0 ? (
          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 shadow-md">
            <MapContainer
              ref={mapRef}
              center={mapCenter}
              zoom={4}
              style={{
                height: "300px", // Reduced from 500px
                width: "100%",
                borderRadius: "8px",
              }}
              className="rounded-lg"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxZoom={19}
              />
              <HeatmapLayer data={heatmapData} />
              <MarkerLayer locations={markerLocations} />
            </MapContainer>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-500 h-[350px] flex items-center justify-center bg-gray-50 dark:bg-gray-700">
            <div className="text-center">
              <MapPin className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No location data available
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Locations Table - More Compact */}
      {markerLocations.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-600 p-4">
          <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
            Response Locations ({markerLocations.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 dark:border-gray-500 bg-gray-50 dark:bg-gray-700">
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">Location</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">City</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">Region</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">Country</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-900 dark:text-white">
                    <div className="flex items-center justify-center">
                      <Users className="w-3 h-3 mr-1" />
                      Responses
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {markerLocations
                  .sort((a, b) => (b.count || 0) - (a.count || 0))
                  .map((location, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">
                        <div className="flex items-center">
                          <MapPin className="w-3 h-3 mr-2 text-blue-600 dark:text-blue-400" />
                          {location.city && location.country
                            ? `${location.city}, ${location.country}`
                            : location.country || location.city || "Unknown"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                        {location.city ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {location.city}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                        {location.region ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                            {location.region}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                        {location.country ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                            {location.country}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 text-blue-800 dark:text-blue-200 min-w-max">
                          {location.count || 1}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}