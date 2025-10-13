import React, { useState, useEffect } from "react";
import { LogIn, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const {
    login,
    error: authError,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const success = await login(email, password);
    if (success) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="bg-white rounded-lg w-full max-w-md border border-neutral-200 shadow-sm">
        {/* Header */}
        <div className="px-6 py-6 border-b border-neutral-200">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-lg mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-medium mb-2">Welcome Back</h1>
            <p className="text-primary-600">Sign in to access your dashboard</p>
          </div>
        </div>

        {/* Form content */}
        <div className="px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-primary-700">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-primary-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`input-field pl-12 pr-4 border ${
                    authError
                      ? "border-red-400 focus:border-red-500"
                      : "border-neutral-200"
                  }`}
                  placeholder="admin@focus.com"
                  required
                  aria-invalid={!!authError}
                  aria-describedby={authError ? "auth-error" : undefined}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-primary-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-primary-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`input-field pl-12 pr-12 border ${
                    authError
                      ? "border-red-400 focus:border-red-500"
                      : "border-neutral-200"
                  }`}
                  placeholder="•••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-primary-400 hover:text-primary-600 transition-colors duration-200"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={authLoading}
                className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In to Dashboard
                  </div>
                )}
              </button>
            </div>
          </form>

          {authError && (
            <div
              id="auth-error"
              className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
            >
              {authError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
