import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2, BarChart3, ArrowRight, AlertCircle, MessageSquare, Phone } from "lucide-react";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export default function GuestAnalyticsLogin() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [step, setStep] = useState<"email" | "otp">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !email) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await apiClient.requestAnalyticsOTP(id, email, phone, channel);
      setStep("otp");
      const successMsg = response?.message || `Verification code sent to your ${channel === 'sms' ? 'phone' : 'email'}`;
      setSuccess(successMsg);
    } catch (err: any) {
      setError(err.message || "Email not found or access denied");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !email || !otp) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.verifyAnalyticsOTP(id, email, otp);
      
      // Clear any existing regular user session from state and storage
      logout();
      
      // Store guest session info
      localStorage.setItem("guest_auth_token", response.token);
      localStorage.setItem("guest_email", response.email);
      localStorage.setItem("guest_form_id", response.formId);
      localStorage.setItem("guest_expires_at", response.expiresAt);
      
      // Redirect to analytics page
      navigate(`/forms/${id}/analytics?guest=true`);
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-50">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-[100px] -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] translate-y-1/2" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-primary-600 rounded-2xl shadow-xl shadow-primary-600/20 mb-4">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Analytics Access
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
            {step === "email" 
              ? "Verify your identity to view the dashboard" 
              : `Enter the verification code sent to your ${channel}`}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 p-8">
          <form onSubmit={step === "email" ? handleRequestOTP : handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-center gap-3 text-red-700 dark:text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-4 flex items-center gap-3 text-green-700 dark:text-green-400">
                <div className="w-5 h-5 flex-shrink-0 bg-green-500 rounded-full flex items-center justify-center">
                  <BarChart3 className="w-3 h-3 text-white" />
                </div>
                <p className="text-sm font-semibold">{success}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  disabled={step === "otp" || isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-600 dark:text-white transition-all font-medium disabled:opacity-70"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                Phone Number
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
                </div>
                <input
                  type="tel"
                  required
                  disabled={step === "otp" || isLoading}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-600 dark:text-white transition-all font-medium disabled:opacity-70"
                />
              </div>
            </div>

            {step === "email" && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                  Verification Channel
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setChannel('email')}
                    className={`
                      flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all
                      ${channel === 'email' 
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-600' 
                        : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}
                    `}
                  >
                    <Mail className="w-5 h-5" />
                    <span className="font-bold text-sm">Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    className={`
                      flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all
                      ${channel === 'sms' 
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600' 
                        : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}
                    `}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-bold text-sm">SMS</span>
                  </button>
                </div>
              </div>
            )}

            {step === "otp" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">
                  Verification Code
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-600 dark:text-white transition-all font-medium tracking-widest"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-primary-600/25 flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {step === "email" ? "Send Verification Code" : "Verify & Access"}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
          This login session will expire in 5 minutes.
        </p>
      </div>
    </div>
  );
}
