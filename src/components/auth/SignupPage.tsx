import React, { useState, useEffect } from "react";
import { User, Lock, Building, Mail, UserPlus, Eye, EyeOff, Globe } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useNotification } from "../../context/NotificationContext";

export default function SignupPage() {
  const { signup, error: authError, loading: authLoading, isAuthenticated } = useAuth();
  const { showSuccess } = useNotification();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    companyName: "",
    adminEmail: "",
    adminPassword: "",
    adminFirstName: "",
    adminLastName: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await signup(formData);
    if (success) {
      showSuccess("Account created successfully! Your 30-day free trial has started.");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white font-sans overflow-hidden">
      
      {/* Left Side: Welcome Panel */}
      <div className="w-full md:w-1/3 bg-[#1e3a8a] text-white p-8 md:p-10 flex flex-col justify-center items-center text-center relative z-20 rounded-b-[3rem] md:rounded-b-none md:rounded-r-[10rem]">
        <div className="max-w-md animate-in fade-in slide-in-from-left-8 duration-700">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 font-sans">Join Us!</h1>
          <p className="text-blue-100 text-base mb-4 font-light font-sans">
            Start your 30-day free trial today. Create up to 5 forms and manage your business with ease.
          </p>
        </div>
        
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
          <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Right Side: Signup Form */}
      <div className="w-full md:w-2/3 flex items-center justify-center p-8 bg-white z-10 overflow-y-auto">
        <div className="w-full max-w-xl animate-in fade-in slide-in-from-right-8 duration-700 py-8">
          <div className="mb-6 text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-800 mb-1 font-sans">Create Account</h2>
            <p className="text-sm text-gray-400 font-sans">Please enter your details to register your organization.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Organization Info */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2 font-sans">Organization Details</h3>
            </div>
            
            <div className="relative group">
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
              <input 
                name="name"
                type="text" 
                value={formData.name}
                onChange={handleChange}
                placeholder="Organization Name" 
                required
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
              />
            </div>

            <div className="relative group">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
              <input 
                name="slug"
                type="text" 
                value={formData.slug}
                onChange={handleChange}
                placeholder="Unique Slug (e.g. my-company)" 
                required
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
              />
            </div>

            <div className="relative group md:col-span-2">
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
              <input 
                name="companyName"
                type="text" 
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Full Company Name" 
                required
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
              />
            </div>

            {/* Admin Info */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2 font-sans">Admin Details</h3>
            </div>

            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
              <input 
                name="adminFirstName"
                type="text" 
                value={formData.adminFirstName}
                onChange={handleChange}
                placeholder="First Name" 
                required
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
              />
            </div>

            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
              <input 
                name="adminLastName"
                type="text" 
                value={formData.adminLastName}
                onChange={handleChange}
                placeholder="Last Name" 
                required
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
              />
            </div>

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
              <input 
                name="adminEmail"
                type="email" 
                value={formData.adminEmail}
                onChange={handleChange}
                placeholder="Admin Email Address" 
                required
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1e3a8a] transition-colors" size={18} />
              <input 
                name="adminPassword"
                type={showPassword ? "text" : "password"}
                value={formData.adminPassword}
                onChange={handleChange}
                placeholder="Password" 
                required
                minLength={6}
                className="w-full pl-11 pr-11 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:bg-white focus:border-[#1e3a8a]/30 transition-all outline-none text-gray-700 text-sm shadow-sm font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="md:col-span-2">
              {authError && (
                <div className="text-xs text-red-500 bg-red-50 p-2.5 rounded-xl text-center border border-red-100 mb-4 font-sans">
                  {authError}
                </div>
              )}

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-[#1e3a8a] text-white rounded-xl font-bold text-base shadow-lg hover:bg-[#1e40af] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:transform-none font-sans"
              >
                {authLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <UserPlus className="mr-2" size={20} />
                    Start Free Trial
                  </>
                )}
              </button>
              
              <div className="mt-6 text-center">
                <p className="text-gray-500 font-sans">
                  Already have an account?{" "}
                  <Link to="/login" className="text-[#1e3a8a] font-bold hover:underline">
                    Login here
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
