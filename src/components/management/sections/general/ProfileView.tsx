import React, { useState } from "react";
import {
  UserCircle,
  Mail,
  Phone,
  Key,
  Camera,
  Lock,
  Shield,
} from "lucide-react";
import type { Profile } from "../../../../types";
import ChangePasswordModal from "./ChangePasswordModal";
import { useAuth } from "../../../../context/AuthContext";

interface ProfileViewProps {
  profile: Profile;
  onEdit: () => void;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ProfileView({
  profile,
  onEdit,
  onAvatarUpload,
}: ProfileViewProps) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const { user } = useAuth();

  // Format role for display
  const formatRole = (role: string) => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <>
      <div className="flex-1 space-y-6">
        <div className="flex items-center space-x-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-neutral-100">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle className="w-full h-full text-neutral-400" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-primary-600 rounded-full p-2 cursor-pointer hover:bg-primary-700 transition-colors shadow-lg">
              <Camera className="w-4 h-4 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={onAvatarUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex-1 space-y-3">
            <h4 className="text-xl font-medium text-primary-600">
              {profile.name}
            </h4>
            <div className="flex items-center text-primary-500">
              <Key className="w-4 h-4 mr-3" />
              <span className="font-mono">{profile.userId}</span>
            </div>
            {user?.role && (
              <div className="flex items-center text-primary-500">
                <Shield className="w-4 h-4 mr-3" />
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {formatRole(user.role)}
                </span>
              </div>
            )}
            <div className="flex items-center text-primary-500">
              <Mail className="w-4 h-4 mr-3" />
              {profile.email}
            </div>
            <div className="flex items-center text-primary-500">
              <Phone className="w-4 h-4 mr-3" />
              {profile.phone}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="btn-secondary flex items-center"
          >
            <Lock className="w-4 h-4 mr-2" />
            Change Password
          </button>
          <button onClick={onEdit} className="btn-primary">
            Edit Profile
          </button>
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </>
  );
}
