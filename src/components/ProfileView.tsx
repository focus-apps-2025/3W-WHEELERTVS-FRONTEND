import React, { useState } from 'react';
import { User, Mail, Phone, Calendar, Edit2, Key } from 'lucide-react';
import type { Profile } from '../types';
import ProfileEdit from './ProfileEdit';

interface ProfileViewProps {
  profile: Profile;
  onUpdateProfile: (profile: Profile) => void;
}

export default function ProfileView({ profile, onUpdateProfile }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (updatedProfile: Profile) => {
    onUpdateProfile(updatedProfile);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit Profile</h2>
        <ProfileEdit
          profile={profile}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h2>
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center px-3 py-2 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Edit
        </button>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <User className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Name</p>
            <p className="text-gray-900 dark:text-white">{profile.name}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Key className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">User ID</p>
            <p className="text-gray-900 dark:text-white font-mono">{profile.userId}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Mail className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="text-gray-900 dark:text-white">{profile.email}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Phone className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <p className="text-gray-900 dark:text-white">{profile.phone}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Member Since</p>
            <p className="text-gray-900 dark:text-white">{new Date(profile.joinDate).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}