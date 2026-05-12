import React, { useState, useEffect, useCallback } from "react";
import { User, Lock, Chrome, Facebook, Github, Linkedin, Eye, EyeOff, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { apiClient } from "../../api/client";

export default function LoginPage() {
  const {
    login,
    error: authError,
    loading: authLoading,
    isAuthenticated,
    user,
  } = useAuth();
  
  // Auth form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Forgot Password workflow states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
   // OTP states
   const [otpResendTimer, setOtpResendTimer] = useState(0);
   const [isOtpResendLoading, setIsOtpResendLoading] = useState(false);
   const [otpSentEmail, setOtpSentEmail] = useState("");
   const [otpSentMobile, setOtpSentMobile] = useState("");
   const [verificationId, setVerificationId] = useState("");
   const [isOtpVerified, setIsOtpVerified] = useState(false);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'inspector') {
        navigate("/attendance-dashboard");
      } else {
        navigate("/dashboard");
      }
    }
  }, [isAuthenticated, user, navigate]);

  // OTP Resend Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showForgotPassword && otpResendTimer > 0) {
      interval = setInterval(() => {
        setOtpResendTimer((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [showForgotPassword, otpResendTimer]);

  // Auto-advance OTP inputs
  const handleOtpChange = useCallback((index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(0, 1);
    }
    if (!/^[0-9]*$/.test(value) && value !== "") {
      return;
    }
    const newOtpCode = [...otpCode];
    newOtpCode[index] = value;
    setOtpCode(newOtpCode);

    if (value !== "" && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      }
    }
  }, [otpCode]);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && otpCode[index] === "" && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) {
        (prevInput as HTMLInputElement).focus();
      }
    }
  }, [otpCode]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const maskMobileNumber = (mobile: string) => {
    if (!mobile) return "";
    if (mobile.length <= 4) return mobile;
    const maskedPart = "*".repeat(mobile.length - 4);
    const lastFour = mobile.slice(-4);
    return maskedPart + lastFour;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
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

      const res = await login(email, password, undefined, locationData);
      if (res && res.user) {
        if (res.user.role === 'inspector') {
          navigate("/attendance-dashboard");
        } else {
          navigate("/dashboard");
        }
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ========== FORGOT PASSWORD HANDLERS ==========

  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await apiClient.post("/auth/forgot-password", {
        email: forgotEmail.toLowerCase().trim()
      });

      const mobile = result?.data?.mobile || "";
      setOtpSentEmail(forgotEmail.toLowerCase().trim());
      setOtpSentMobile(mobile);
      setShowForgotPassword(true);
      setOtpResendTimer(60);
      setSuccess("OTP has been sent to your registered mobile number. Please check your mobile for the OTP.");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const fullOtp = otpCode.join("");
    if (fullOtp.length !== 6) {
      setError("Please enter all 6 digits of OTP");
      setLoading(false);
      return;
    }

    try {
      const result = await apiClient.post("/auth/verify-forgot-otp", {
        email: otpSentEmail,
        otp: fullOtp
      });

      setVerificationId(result.verificationId || result.data?.verificationId || "");
      setSuccess("OTP verified! Please set your new password.");
      setIsOtpVerified(true);
    } catch (err: any) {
      setError(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await apiClient.post("/auth/reset-password", {
        email: otpSentEmail,
        verificationId,
        newPassword
      });
      setLoading(false);

      setSuccess("Password reset successful! You can now sign in with your new password.");
      setTimeout(() => {
        handleCancelForgot();
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    }finally {
     setLoading(false); // ✅ ADD THIS as safety net
}
  };

  const handleResendOtp = async () => {
    setIsOtpResendLoading(true);
    setError("");

    try {
      await apiClient.post("/auth/resend-forgot-otp", {
        email: otpSentEmail.toLowerCase().trim()
      });
      setOtpResendTimer(60);
      setSuccess("New OTP has been sent to your registered mobile number.");
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP");
    } finally {
      setIsOtpResendLoading(false);
    }
  };

  const handleCancelForgot = () => {
    setShowForgotPassword(false);
    setForgotEmail("");
    setOtpCode(["", "", "", "", "", ""]);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
    setOtpResendTimer(0);
    setVerificationId("");
    setOtpSentEmail("");
    setOtpSentMobile("");
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
  };

  const handleBackToEmail = () => {
    setOtpSentEmail("");
    setOtpSentMobile("");
    setOtpCode(["", "", "", "", "", ""]);
    setError("");
    setSuccess("");
  };

  const handleBackToOtp = () => {
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
    setIsOtpVerified(false);
  };

  const socialIcons = [Chrome, Facebook, Github, Linkedin];

  return (
    <div className="min-h-screen md:h-screen w-full flex flex-col md:flex-row bg-white font-sans overflow-x-hidden">

      {/* Left Side: Welcome Panel - Full Height, Blue Background, Smaller Curve */}
      <div className="w-full md:w-1/2 flex-none md:flex-1 bg-[#1e3a8a] text-white p-8 md:p-12 flex flex-col justify-center items-center text-center relative z-20 rounded-b-[3rem] md:rounded-b-none md:rounded-r-[10rem] min-h-[40vh] md:min-h-0">
        <div className="max-w-md animate-in fade-in slide-in-from-left-8 duration-700">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Hello, Welcome!</h1>
          <p className="text-blue-100 text-base md:text-lg mb-4 font-light font-sans">
            Access your dashboard and manage your forms with ease.
          </p>
        </div>

        {/* Subtle decorative background elements for the blue side */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
          <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Right Side: Login Form - Centered on White Background */}
      <div className="w-full md:w-1/2 flex-1 flex items-center justify-center p-8 md:p-12 bg-white z-10 overflow-y-auto relative">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-right-8 duration-700">
          
          {/* ========== MAIN LOGIN FORM ========== */}
          {!showForgotPassword && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-1">Login</h2>
                <p className="text-sm text-gray-400">Please enter your details to sign in.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
                  />
                </div>

                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setError("");
                      }}
                      className="text-sm font-medium text-gray-400 hover:text-[#1e3a8a] transition-colors font-sans"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {(authError || error) && (
                    <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl text-center border border-red-100 animate-in fade-in zoom-in duration-300 font-sans">
                      {authError || error}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={authLoading || loading}
                  className="w-full py-3 bg-[#1e3a8a] text-white rounded-xl font-bold text-base shadow-lg shadow-blue-100 hover:bg-[#1e40af] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:transform-none disabled:shadow-none mt-4 font-sans"
                >
                  {(authLoading || loading) ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "Login"
                  )}
                </button>
              </form>
            </>
          )}

          {/* ========== FORGOT PASSWORD OVERLAY ========== */}
          {showForgotPassword && (
            <div className="w-full max-w-sm animate-in fade-in zoom-in duration-300">
              {/* Step 1: Email Input (shown when no OTP sent yet and not in password reset step) */}
              {!otpSentEmail && !newPassword && !isOtpVerified && (
                <>
                  <div className="mb-8">
                    <button
                      type="button"
                      onClick={handleBackToLogin}
                      className="flex items-center gap-2 text-gray-400 hover:text-[#1e3a8a] transition-colors mb-4 font-sans"
                    >
                      <ArrowLeft size={20} />
                      <span className="text-sm">Back to login</span>
                    </button>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Forgot Password</h2>
                    <p className="text-sm text-gray-400">Enter your email to receive an OTP on your registered mobile number.</p>
                  </div>

                  <form onSubmit={handleForgotEmailSubmit} className="space-y-6">
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="Email Address"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
                      />
                    </div>

                    {error && (
                      <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl text-center border border-red-100 animate-in fade-in zoom-in duration-300 font-sans">
                        {error}
                      </div>
                    )}

                    {success && !otpSentEmail && (
                      <div className="text-sm text-green-600 bg-green-50 p-3 rounded-xl text-center border border-green-100 animate-in fade-in zoom-in duration-300 font-sans leading-relaxed">
                        {success}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-[#1e3a8a] text-white rounded-xl font-bold text-base shadow-lg shadow-blue-100 hover:bg-[#1e40af] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:transform-none disabled:shadow-none mt-4 font-sans"
                    >
                      {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        "Send OTP"
                      )}
                    </button>
                  </form>
                </>
              )}

               {/* Step 2: OTP Verification (shown when OTP sent but password not yet entered) */}
               {otpSentEmail && !isOtpVerified && !newPassword && (
                <>
                  <div className="mb-8">
                    <button
                      type="button"
                      onClick={handleBackToEmail}
                      className="flex items-center gap-2 text-gray-400 hover:text-[#1e3a8a] transition-colors mb-4 font-sans"
                    >
                      <ArrowLeft size={20} />
                      <span className="text-sm">Back</span>
                    </button>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Verify OTP</h2>
                    <p className="text-sm text-gray-400">Enter the 6-digit OTP sent to your registered mobile number.</p>
                    {otpSentMobile && (
                      <p className="text-xs text-gray-500 mt-1">Mobile: <span className="font-medium text-gray-700">{maskMobileNumber(otpSentMobile)}</span></p>
                    )}
                  </div>

                  <form onSubmit={handleForgotOtpSubmit} className="space-y-6">
                    <div className="flex justify-center gap-2">
                      {otpCode.map((digit, index) => (
                        <input
                          key={index}
                          id={`otp-input-${index}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className="w-12 h-14 text-center text-xl font-bold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a] transition-all outline-none text-gray-700"
                          placeholder="0"
                        />
                      ))}
                    </div>

                    {error && (
                      <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl text-center border border-red-100 animate-in fade-in zoom-in duration-300 font-sans">
                        {error}
                      </div>
                    )}

                    {success && (
                      <div className="text-sm text-green-600 bg-green-50 p-3 rounded-xl text-center border border-green-100 animate-in fade-in zoom-in duration-300 font-sans">
                        {success}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-[#1e3a8a] text-white rounded-xl font-bold text-base shadow-lg shadow-blue-100 hover:bg-[#1e40af] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:transform-none disabled:shadow-none mt-4 font-sans"
                    >
                      {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        "Verify OTP"
                      )}
                    </button>

                    <div className="text-center">
                      {otpResendTimer > 0 ? (
                        <p className="text-sm text-gray-400 font-sans">
                          Resend OTP in <span className="font-medium text-[#1e3a8a]">{formatTime(otpResendTimer)}</span>
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={isOtpResendLoading}
                          className="text-sm font-medium text-[#1e3a8a] hover:text-[#1e40af] transition-colors disabled:opacity-50 font-sans"
                        >
                          {isOtpResendLoading ? "Sending..." : "Resend OTP"}
                        </button>
                      )}
                    </div>
                  </form>
                </>
              )}

               {/* Step 3: Set New Password (shown after OTP verified) */}
               {isOtpVerified && (
                <>
                  <div className="mb-8">
                    <button
                      type="button"
                      onClick={handleBackToOtp}
                      className="flex items-center gap-2 text-gray-400 hover:text-[#1e3a8a] transition-colors mb-4 font-sans"
                    >
                      <ArrowLeft size={20} />
                      <span className="text-sm">Back</span>
                    </button>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Set New Password</h2>
                    <p className="text-sm text-gray-400">Enter your new password below.</p>
                  </div>

                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password"
                        required
                        minLength={6}
                        className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                      >
                        {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>

                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm Password"
                        required
                        className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                      >
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>

                    {error && (
                      <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl text-center border border-red-100 animate-in fade-in zoom-in duration-300 font-sans">
                        {error}
                      </div>
                    )}

                    {success && (
                      <div className="text-sm text-green-600 bg-green-50 p-3 rounded-xl text-center border border-green-100 animate-in fade-in zoom-in duration-300 font-sans">
                        {success}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-[#1e3a8a] text-white rounded-xl font-bold text-base shadow-lg shadow-blue-100 hover:bg-[#1e40af] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:transform-none disabled:shadow-none mt-4 font-sans"
                    >
                      {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        "Set New Password"
                      )}
                    </button>
                  </form>
                </>
              )}

              {/* Success Message */}
              {success && !error && !loading && !newPassword && !otpSentEmail && (
                <div className="text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={40} className="text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Password Reset Successful!</h2>
                  <p className="text-sm text-gray-400 mb-6">Your password has been updated. You can now sign in with your new password.</p>
                  <button
                    onClick={handleCancelForgot}
                    className="px-8 py-3 bg-[#1e3a8a] text-white rounded-xl font-bold shadow-lg hover:bg-[#1e40af] transition-all"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}