import React from "react";
import { Image } from "lucide-react";
import { useLogo } from "../../../../context/LogoContext";

export default function LogoSection() {
  const { logo, updateLogo } = useLogo();

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        // 1MB limit
        alert("Logo file size should be less than 1MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        updateLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-6 bg-neutral-50 rounded-lg">
      <div className="flex items-center space-x-4 mb-6">
        <div className="p-3 bg-primary-50 rounded-lg">
          <Image className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h4 className="text-lg font-medium text-primary-600">Company Logo</h4>
          <p className="text-primary-500">
            Upload your company logo for branding
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <div className="flex-shrink-0 w-24 h-24 bg-white rounded-lg overflow-hidden shadow-sm">
          {logo ? (
            <img
              src={logo}
              alt="Company logo"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-50">
              <Image className="w-8 h-8 text-neutral-400" />
            </div>
          )}
        </div>

        <div className="flex-1">
          <label className="flex flex-col items-center px-6 py-8 bg-white rounded-lg cursor-pointer hover:bg-neutral-50 transition-colors shadow-sm">
            <div className="flex items-center">
              <Image className="w-6 h-6 text-primary-600 mr-2" />
              <span className="text-primary-600 font-medium">
                {logo ? "Change logo" : "Upload a logo"}
              </span>
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleLogoUpload}
            />
            <p className="mt-2 text-sm text-primary-500">
              PNG, JPG or GIF (Max. 1MB)
            </p>
          </label>
        </div>
      </div>
    </div>
  );
}
