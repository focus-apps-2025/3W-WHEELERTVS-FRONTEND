import React, { useState, useEffect } from "react";
import { User, Lock, Chrome, Facebook, Github, Linkedin, Eye, EyeOff } from "lucide-react";
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

  const socialIcons = [Chrome, Facebook, Github, Linkedin];

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white font-sans overflow-hidden">
      
      {/* Left Side: Welcome Panel - Full Height, Blue Background, Smaller Curve */}
      <div className="w-full md:w-1/2 bg-[#6F8EF6] text-white p-8 md:p-16 flex flex-col justify-center items-center text-center relative z-20 rounded-b-[3rem] md:rounded-b-none md:rounded-r-[10rem]">
        <div className="max-w-md animate-in fade-in slide-in-from-left-8 duration-700">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Hello, Welcome!</h1>
          <p className="text-blue-100 text-lg md:text-xl mb-4 font-light">
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
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-white z-10">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-right-8 duration-700">
          <div className="mb-10">
            <h2 className="text-4xl font-bold text-gray-800 mb-2">Login</h2>
            <p className="text-gray-400">Please enter your details to sign in.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#6F8EF6] transition-colors" size={22} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address" 
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-[#6F8EF6]/20 focus:bg-white focus:border-[#6F8EF6]/30 transition-all outline-none text-gray-700 text-lg shadow-sm"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#6F8EF6] transition-colors" size={22} />
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password" 
                required
                className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-[#6F8EF6]/20 focus:bg-white focus:border-[#6F8EF6]/30 transition-all outline-none text-gray-700 text-lg shadow-sm"
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
                <a href="#" className="text-sm font-medium text-gray-400 hover:text-[#6F8EF6] transition-colors">Forgot password?</a>
              </div>
              
              {authError && (
                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl text-center border border-red-100 animate-in fade-in zoom-in duration-300">
                  {authError}
                </div>
              )}
            </div>

            <button 
              type="submit"
              disabled={authLoading}
              className="w-full py-4 bg-[#6F8EF6] text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 hover:bg-[#5A7DE9] hover:-translate-y-1 transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:transform-none disabled:shadow-none mt-4"
            >
              {authLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "Login"
              )}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-400 mb-8 relative flex items-center justify-center">
              <span className="bg-white px-6 relative z-10">or login with social platforms</span>
              <span className="absolute w-full h-[1px] bg-gray-100 top-1/2"></span>
            </p>
            
            <div className="flex justify-center gap-6">
              {socialIcons.map((Icon, index) => (
                <button 
                  key={index} 
                  className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-[#6F8EF6]/30 hover:-translate-y-1 transition-all text-gray-600 hover:text-[#6F8EF6]"
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
