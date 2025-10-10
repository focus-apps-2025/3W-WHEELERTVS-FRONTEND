import React from "react";
import {
  MapPin,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Clock,
  Wifi,
} from "lucide-react";

interface LocationData {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
}

interface SubmissionMetadata {
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  device?: string;
  os?: string;
  location?: LocationData;
  submittedAt?: string;
}

interface SubmissionMetadataProps {
  metadata?: SubmissionMetadata;
  compact?: boolean;
}

export default function SubmissionMetadata({
  metadata,
  compact = false,
}: SubmissionMetadataProps) {
  if (!metadata) {
    return null;
  }

  const getDeviceIcon = (device?: string) => {
    if (!device) return <Monitor className="w-4 h-4" />;
    const deviceLower = device.toLowerCase();
    if (deviceLower.includes("mobile"))
      return <Smartphone className="w-4 h-4" />;
    if (deviceLower.includes("tablet")) return <Tablet className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const getLocationString = (location?: LocationData) => {
    if (!location) return "Unknown";
    const parts = [];
    if (location.city) parts.push(location.city);
    if (location.region) parts.push(location.region);
    if (location.country) parts.push(location.country);
    return parts.length > 0 ? parts.join(", ") : "Unknown";
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {metadata.location && (
          <div className="flex items-center">
            <MapPin className="w-3 h-3 mr-1 text-blue-500" />
            <span>{getLocationString(metadata.location)}</span>
          </div>
        )}
        {metadata.device && (
          <div className="flex items-center">
            {getDeviceIcon(metadata.device)}
            <span className="ml-1">{metadata.device}</span>
          </div>
        )}
        {metadata.submittedAt && (
          <div className="flex items-center">
            <Clock className="w-3 h-3 mr-1 text-gray-500" />
            <span>{formatDateTime(metadata.submittedAt)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
        <Globe className="w-4 h-4 mr-2 text-blue-600" />
        Submission Information
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Date & Time */}
        {metadata.submittedAt && (
          <div className="flex items-start">
            <Clock className="w-4 h-4 mr-2 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">Submitted At</div>
              <div className="text-sm font-medium text-gray-700">
                {formatDateTime(metadata.submittedAt)}
              </div>
            </div>
          </div>
        )}

        {/* Location */}
        {metadata.location && (
          <div className="flex items-start">
            <MapPin className="w-4 h-4 mr-2 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">Location</div>
              <div className="text-sm font-medium text-gray-700">
                {getLocationString(metadata.location)}
              </div>
              {metadata.location.timezone && (
                <div className="text-xs text-gray-500 mt-0.5">
                  Timezone: {metadata.location.timezone}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Device */}
        {metadata.device && (
          <div className="flex items-start">
            {getDeviceIcon(metadata.device)}
            <div className="ml-2">
              <div className="text-xs text-gray-500">Device</div>
              <div className="text-sm font-medium text-gray-700">
                {metadata.device}
              </div>
              {metadata.os && (
                <div className="text-xs text-gray-500 mt-0.5">
                  OS: {metadata.os}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Browser */}
        {metadata.browser && (
          <div className="flex items-start">
            <Globe className="w-4 h-4 mr-2 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">Browser</div>
              <div className="text-sm font-medium text-gray-700">
                {metadata.browser}
              </div>
            </div>
          </div>
        )}

        {/* IP Address */}
        {metadata.ipAddress && (
          <div className="flex items-start">
            <Wifi className="w-4 h-4 mr-2 text-purple-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">IP Address</div>
              <div className="text-sm font-medium text-gray-700 font-mono">
                {metadata.ipAddress}
              </div>
              {metadata.location?.isp && (
                <div className="text-xs text-gray-500 mt-0.5">
                  ISP: {metadata.location.isp}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Coordinates (if available) */}
        {metadata.location?.latitude && metadata.location?.longitude && (
          <div className="flex items-start col-span-full">
            <MapPin className="w-4 h-4 mr-2 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">Coordinates</div>
              <div className="text-sm font-medium text-gray-700">
                {metadata.location.latitude.toFixed(4)},{" "}
                {metadata.location.longitude.toFixed(4)}
              </div>
              <a
                href={`https://www.google.com/maps?q=${metadata.location.latitude},${metadata.location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 inline-block"
              >
                View on Google Maps
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
