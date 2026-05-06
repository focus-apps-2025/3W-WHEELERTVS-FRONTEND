import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Navigation, Save, Loader2 } from 'lucide-react';
import type { Profile } from '../../types';
import { apiClient } from '../../api/client';
import { useNotification } from '../../context/NotificationContext';

interface SettingsProfileProps {
  onClose: () => void;
}

export default function SettingsProfile({ onClose }: SettingsProfileProps) {
  const [profile, setProfile] = useState<Profile>({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    joinDate: '2024-01-01',
    userId: 'USER12345',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  });
  
  const [officeLocation, setOfficeLocation] = useState({
    lat: '',
    lng: '',
    radius: 5,
  });
  const [currentOfficeLocation, setCurrentOfficeLocation] = useState<{lat: number, lng: number, radius: number} | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const role = (userData as any)?.role || (userData as any)?.roles?.[0];
    setIsTenantAdmin(['admin', 'superadmin', 'subadmin'].includes(role));
    
    const fetchLocation = async () => {
      try {
        const response = await apiClient.getOfficeLocation();
        if (response.success && response.data) {
          const data = response.data;
          setOfficeLocation({
            lat: data.lat?.toString() || '',
            lng: data.lng?.toString() || '',
            radius: data.radius || 500,
          });
          setCurrentOfficeLocation(data);
        }
      } catch (error) {
        console.error('Error fetching office location:', error);
      }
    };
    fetchLocation();
  }, []);

  const handleGetLocation = () => {
    console.log("📍 Requesting current location...");
    setIsDetectingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("✅ Location received:", position.coords);
          setOfficeLocation(prev => ({
            ...prev,
            lat: position.coords.latitude.toFixed(6),
            lng: position.coords.longitude.toFixed(6),
          }));
          showSuccess('Location captured!');
          setIsDetectingLocation(false);
        },
        (error) => {
          console.error("❌ Geolocation error:", error);
          let msg = "Failed to get location";
          if (error.code === 1) msg = "Location permission denied. Please enable GPS.";
          else if (error.code === 2) msg = "Location unavailable. Please check your network.";
          else if (error.code === 3) msg = "Location request timed out.";
          
          showError(msg + " (" + error.message + ")");
          setIsDetectingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      showError('Geolocation not supported by this browser');
      setIsDetectingLocation(false);
    }
  };

  const handleSaveLocation = async () => {
    setLoadingLocation(true);
    try {
      const updateData = {
        lat: parseFloat(officeLocation.lat),
        lng: parseFloat(officeLocation.lng),
        radius: parseInt(officeLocation.radius.toString()),
      };
      console.log('Updating office location:', updateData);
      const response = await apiClient.updateOfficeLocation(updateData);
      console.log('Update response:', response);

      // Update local state to reflect the change
      setCurrentOfficeLocation(updateData);

      showSuccess('Office location updated!');
    } catch (error: any) {
      console.error('Failed to update office location:', error);
      showError(error.response?.message || 'Failed to update location');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('userProfile', JSON.stringify(profile));
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center space-x-6">
        <div className="relative">
          <img
            src={profile.avatar}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover"
          />
          <label className="absolute bottom-0 right-0 bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg cursor-pointer">
            <Camera className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white">Profile Picture</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            JPG, GIF or PNG. Max size of 800K
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            User ID
          </label>
          <input
            type="text"
            value={profile.userId}
            readOnly
            className="w-full px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
      </div>

      {isTenantAdmin && (
        <div className="border-t pt-6 mt-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Office Location (Attendance)
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Set your office location for inspector attendance check-in verification
          </p>

          {currentOfficeLocation && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Current Office Location:</p>
              <p className="text-xs text-blue-600 dark:text-blue-300">
                Lat: {currentOfficeLocation.lat}, Lng: {currentOfficeLocation.lng}, Radius: {currentOfficeLocation.radius}m
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Latitude
              </label>
              <input
                type="text"
                value={officeLocation.lat}
                onChange={(e) => setOfficeLocation({ ...officeLocation, lat: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="12.9455"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Longitude
              </label>
              <input
                type="text"
                value={officeLocation.lng}
                onChange={(e) => setOfficeLocation({ ...officeLocation, lng: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="78.8754"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Radius (meters)
              </label>
              <input
                type="number"
                value={officeLocation.radius}
                onChange={(e) => setOfficeLocation({ ...officeLocation, radius: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                min="10"
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isDetectingLocation}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center disabled:opacity-50"
            >
              {isDetectingLocation ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 mr-2" />
                  Get Current Location
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSaveLocation}
              disabled={loadingLocation || !officeLocation.lat || !officeLocation.lng}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {loadingLocation ? 'Saving...' : 'Save Location'}
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}