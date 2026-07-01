import React from "react";
import { Camera } from "lucide-react";
import type { Profile } from "../../../../types";

interface ProfileFormProps {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onCancel: () => void;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ProfileForm({
  profile,
  onSave,
  onCancel,
  onAvatarUpload,
}: ProfileFormProps) {
  const [formData, setFormData] = React.useState(profile);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 space-y-6">
      <div className="flex items-center space-x-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-neutral-100">
            {formData.avatar ? (
              <img
                src={formData.avatar}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Camera className="w-12 h-12 text-neutral-400" />
              </div>
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-primary-600 rounded-full p-2 cursor-pointer hover:bg-primary-700 transition-colors">
            <Camera className="w-4 h-4 text-white" />
            <input
              type="file"
              accept="image/*"
              onChange={onAvatarUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex-1 space-y-4">
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            className="input-field"
            placeholder="Full Name"
          />
          <input
            type="text"
            value={formData.userId}
            className="input-field bg-neutral-100 text-neutral-500 cursor-not-allowed font-mono"
            readOnly
          />
          <input
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            className="input-field"
            placeholder="Email Address"
          />
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value }))
            }
            className="input-field"
            placeholder="Phone Number"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Save Changes
        </button>
      </div>
    </form>
  );
}
