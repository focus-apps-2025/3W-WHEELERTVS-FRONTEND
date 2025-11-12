import React, { useState, useEffect } from "react";
import { LogIn, Mail, Lock, Eye, EyeOff, Sparkles } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-900 dark:from-gray-900 dark:to-gray-950 flex">
      {/* Left Side - Welcome Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-700 to-primary-800 dark:from-gray-800 dark:to-gray-900">
        {/* Floating Elements */}
        <div className="absolute inset-0">
          <div className="floating-circle floating-circle-1"></div>
          <div className="floating-circle floating-circle-2"></div>
          <div className="floating-circle floating-circle-3"></div>
          <div className="floating-circle floating-circle-4"></div>
          <div className="floating-circle floating-circle-5"></div>
        </div>

        {/* Welcome Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="max-w-md text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full mb-8">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Welcome Back!</h1>
            <p className="text-xl text-primary-100 mb-8 leading-relaxed">
              Access your dashboard and manage your forms with ease. Sign in to continue your journey.
            </p>
            <div className="flex items-center justify-center space-x-2 text-primary-200">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm">Secure • Professional • Efficient</span>
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Header */}
          <div className="lg:hidden text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 dark:bg-primary-500 rounded-lg mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-2">Welcome Back</h1>
            <p className="text-primary-600 dark:text-primary-300">Sign in to access your dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 pl-12 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-primary-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
                  placeholder="admin@focus.com"
                  required
                  aria-invalid={!!authError}
                  aria-describedby={authError ? "auth-error" : undefined}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pl-12 pr-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-primary-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
                  placeholder="•••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
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
            <div className="pt-2">
              <button
                type="submit"
                disabled={authLoading}
                className="w-16 h-16 mx-auto bg-blue-600 dark:bg-primary-500 hover:bg-blue-700 dark:hover:bg-primary-400 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center"
              >
                {authLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <LogIn className="w-6 h-6" />
                )}
              </button>
            </div>
          </form>

          {authError && (
            <div
              id="auth-error"
              className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3"
            >
              {authError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
