import React, { useState, useEffect } from "react";
import { X, Edit2, Save, Mail, User, Briefcase, Phone, Building2, AlertCircle, Lock, MapPin, Navigation } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import ChangePasswordModal from "./management/sections/general/ChangePasswordModal";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, tenant, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [officeLocation, setOfficeLocation] = useState({ lat: '', lng: '', radius: 500 });
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    mobile: user?.mobile || "",
    department: user?.department || "",
    position: user?.position || "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        mobile: user.mobile || "",
        department: user.department || "",
        position: user.position || "",
      });
      
      // Check if user is tenant admin
      const role = (user as any).role || (user as any).roles?.[0];
      setIsTenantAdmin(role === 'admin' || role === 'tenant_admin');
      
      // Fetch office location if tenant admin
      if (role === 'admin' || role === 'tenant_admin') {
        const fetchLocation = async () => {
          try {
            const response = await apiClient.getOfficeLocation();
            if (response.success && response.data) {
              setOfficeLocation({
                lat: response.data.lat?.toString() || '',
                lng: response.data.lng?.toString() || '',
                radius: response.data.radius || 500,
              });
            }
          } catch (error) {
            console.error('Error fetching office location:', error);
          }
        };
        fetchLocation();
      }
    }
  }, [user, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        mobile: formData.mobile,
        department: formData.department,
        position: formData.position,
      };

      const response = await apiClient.updateUserProfile(updateData);
      
      if (response && response.user) {
        updateUser(response.user);
      }
      
      setSuccessMessage("Profile updated successfully!");
      setIsEditing(false);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update profile. Please try again.";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOfficeLocation(prev => ({
            ...prev,
            lat: position.coords.latitude.toFixed(6),
            lng: position.coords.longitude.toFixed(6),
          }));
          setSuccessMessage("Location captured!");
        },
        (error) => {
          setError("Failed to get location: " + error.message);
        }
      );
    } else {
      setError("Geolocation not supported");
    }
  };

  const handleSaveLocation = async () => {
    setIsSaving(true);
    try {
      await apiClient.updateOfficeLocation({
        lat: parseFloat(officeLocation.lat),
        lng: parseFloat(officeLocation.lng),
        radius: parseInt(officeLocation.radius.toString()),
      });
      setSuccessMessage("Office location updated!");
      setShowLocationModal(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update location";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEditing ? "Edit Profile" : "Profile"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Tenant Info - Always visible */}
          {tenant && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start space-x-3">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Organization</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{tenant.companyName || tenant.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-300">{successMessage}</p>
            </div>
          )}

          {/* Profile Content */}
          {isEditing ? (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mobile
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  placeholder="e.g., +1 (555) 123-4567"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div> */}

              {/* <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Department
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  placeholder="e.g., Sales, Engineering, HR"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div> */}

              {/* <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Position
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  placeholder="e.g., Manager, Developer, Analyst"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div> */}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Name - Always show if available */}
              {(user?.firstName || user?.lastName) && (
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Name</p>
                    <p className="text-sm text-gray-900 dark:text-white truncate">
                      {user?.firstName} {user?.lastName}
                    </p>
                  </div>
                </div>
              )}

              {/* Email - Always show if available */}
              {user?.email && (
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</p>
                    <p className="text-sm text-gray-900 dark:text-white truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              )}

              {/* Mobile - Only show if available */}
              {user?.mobile && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Mobile</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {user?.mobile}
                    </p>
                  </div>
                </div>
              )}

              {/* Department - Only show if available */}
              {user?.department && (
                <div className="flex items-center space-x-3">
                  <Briefcase className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Department</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {user?.department}
                    </p>
                  </div>
                </div>
              )}

              {/* Position - Only show if available */}
              {user?.position && (
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Position</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {user?.position}
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-4 space-y-3">
                {isTenantAdmin && (
                  <>
                    <button
                      onClick={() => setShowLocationModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      Office Location (Attendance)
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setError(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </button>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  Change Password
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}

      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Office Location
              </h3>
              <button onClick={() => setShowLocationModal(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Set the office location for inspector attendance check-in
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Latitude
                </label>
                <input
                  type="text"
                  value={officeLocation.lat}
                  onChange={(e) => setOfficeLocation({ ...officeLocation, lat: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="10"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleGetCurrentLocation}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <Navigation className="w-4 h-4" />
                Get Location
              </button>
              <button
                onClick={handleSaveLocation}
                disabled={isSaving || !officeLocation.lat || !officeLocation.lng}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
