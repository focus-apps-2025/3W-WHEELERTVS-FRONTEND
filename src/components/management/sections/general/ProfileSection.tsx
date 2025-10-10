import React, { useState } from "react";
import { UserCircle } from "lucide-react";
import type { Profile } from "../../../../types";
import ProfileView from "./ProfileView";
import ProfileForm from "./ProfileForm";

export default function ProfileSection() {
  const [profile, setProfile] = useState<Profile>(() => {
    const savedProfile = localStorage.getItem("userProfile");
    return savedProfile
      ? JSON.parse(savedProfile)
      : {
          name: "John Doe",
          email: "john.doe@example.com",
          phone: "+1 (555) 123-4567",
          userId: "USER1234",
          joinDate: new Date().toISOString(),
          avatar:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
        };
  });

  const [isEditing, setIsEditing] = useState(false);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file");
        return;
      }

      // Validate file size (1MB limit)
      if (file.size > 1024 * 1024) {
        alert("Profile picture size should be less than 1MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const updatedProfile = { ...profile, avatar: reader.result as string };
        setProfile(updatedProfile);
        localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (updatedProfile: Profile) => {
    localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
    setProfile(updatedProfile);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-blue-50 rounded-lg">
          <UserCircle className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h4 className="text-md font-medium text-gray-900">
            Profile Information
          </h4>
          <p className="text-sm text-gray-500">
            Manage your personal information
          </p>
        </div>
      </div>

      {isEditing ? (
        <ProfileForm
          profile={profile}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          onAvatarUpload={handleAvatarUpload}
        />
      ) : (
        <ProfileView
          profile={profile}
          onEdit={() => setIsEditing(true)}
          onAvatarUpload={handleAvatarUpload}
        />
      )}
    </div>
  );
}
