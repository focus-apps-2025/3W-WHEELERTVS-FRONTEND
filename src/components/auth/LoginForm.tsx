import React, { useState } from "react";
import { LogIn, X, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface LoginFormProps {
  onClose: () => void;
}

export default function LoginForm({ onClose }: LoginFormProps) {
  const { login, error: authError, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("superadmin@focus.com");
  const [password, setPassword] = useState("superadmin123#");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let locationData: { status: string; latitude?: number; longitude?: number } = { status: 'unknown' };

    if ("geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 0
          });
        });
        locationData = {
          status: 'granted',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (err) {
        locationData = { status: 'denied' };
      }
    }

    const success = await login(email, password, undefined, locationData);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl border border-white/20 overflow-hidden my-auto animate-in fade-in zoom-in duration-300">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-br from-[#1e3a8a] via-blue-700 to-indigo-900 px-6 sm:px-8 py-8 sm:py-10 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-white/10 backdrop-blur-md rounded-2xl mb-4 shadow-inner">
              <LogIn className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-blue-100/80 text-sm sm:text-base font-light">
              Sign in to access your dashboard
            </p>
          </div>
        </div>

        {/* Form content */}
        <div className="px-6 sm:px-8 py-8 sm:py-10 space-y-6">
          {authError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-start space-x-3 animate-in shake-2 duration-300">
              <div className="flex-shrink-0 w-5 h-5 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mt-0.5">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
              <div className="text-sm font-medium">{authError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-[#1e3a8a]/10 focus:border-[#1e3a8a]/30 transition-all duration-200 bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm"
                  placeholder="admin@focus.com"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-[#1e3a8a]/10 focus:border-[#1e3a8a]/30 transition-all duration-200 bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors duration-200"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col space-y-3 pt-4">
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-[#1e3a8a] hover:bg-[#1e40af] text-white py-4 px-6 rounded-2xl font-bold transition-all duration-200 shadow-lg shadow-blue-100 dark:shadow-none hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {authLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                    Signing in...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <LogIn className="w-5 h-5 mr-3" />
                    Sign In to Dashboard
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 py-3.5 px-6 rounded-2xl font-bold transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-900/20">
            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm text-center">
              Demo Credentials
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Super Admin</span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded-lg text-[#1e3a8a] border border-blue-50 dark:border-blue-900/30 whitespace-nowrap">
                    superadmin@focus.com
                  </code>
                  <span className="text-gray-300">/</span>
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded-lg text-[#1e3a8a] border border-blue-50 dark:border-blue-900/30 whitespace-nowrap">
                    superadmin123#
                  </code>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 pt-2 border-t border-blue-100/30 dark:border-blue-900/10">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Admin</span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded-lg text-indigo-600 border border-blue-50 dark:border-blue-900/30 whitespace-nowrap">
                    krishna@focusengineering.in
                  </code>
                  <span className="text-gray-300">/</span>
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded-lg text-indigo-600 border border-blue-50 dark:border-blue-900/30 whitespace-nowrap">
                    krishna123
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
