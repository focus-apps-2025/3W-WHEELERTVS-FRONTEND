import React, { useState, useEffect } from "react";
import { User, Lock, Chrome, Facebook, Github, Linkedin, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function LoginPage() {
  const {
    login,
    error: authError,
    loading: authLoading,
    isAuthenticated,
    user,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get user location
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
      <div className="w-full md:w-1/2 flex-1 flex items-center justify-center p-8 md:p-12 bg-white z-10 overflow-y-auto">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-right-8 duration-700">
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
                <a href="#" className="text-sm font-medium text-gray-400 hover:text-[#1e3a8a] transition-colors font-sans">Forgot password?</a>
              </div>

              {authError && (
                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl text-center border border-red-100 animate-in fade-in zoom-in duration-300 font-sans">
                  {authError}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-[#1e3a8a] text-white rounded-xl font-bold text-base shadow-lg shadow-blue-100 hover:bg-[#1e40af] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:transform-none disabled:shadow-none mt-4 font-sans"
            >
              {authLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "Login"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500 font-sans">
              Don't have an account?{" "}
              <Link to="/signup" className="text-[#1e3a8a] font-bold hover:underline">
                Sign up for a Free Trial
              </Link>
            </p>
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-400 mb-8 relative flex items-center justify-center font-sans">
              <span className="bg-white px-6 relative z-10">or login with social platforms</span>
              <span className="absolute w-full h-[1px] bg-gray-100 top-1/2"></span>
            </p>

            <div className="flex justify-center gap-6">
              {socialIcons.map((Icon, index) => (
                <button
                  key={index}
                  className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-[#1e3a8a]/30 hover:-translate-y-1 transition-all text-gray-600 hover:text-[#1e3a8a]"
                >
                  <Icon size={24} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
