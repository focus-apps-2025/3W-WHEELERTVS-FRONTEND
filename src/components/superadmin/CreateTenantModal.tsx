import React, { useState, useEffect } from "react";
import {
  X,
  Building2,
  User,
  Mail,
  Lock,
  Tag,
  Briefcase,
  Eye,
  EyeOff,
  Phone,
  CheckCircle,
  MapPin,
  Navigation,
  Globe,
  Crown,
  Users,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useNotification } from "../../context/NotificationContext";
import { apiClient } from "../../api/client";

interface CreateTenantModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateTenantModal({
  onClose,
  onSuccess,
}: CreateTenantModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    companyName: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPassword: "",
    adminMobile: "",
    plan: "basic",
    maxUsers: 10,
    maxForms: 50,
    officeLat: "",
    officeLng: "",
    attendanceRadius: 500,
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [showCustomerPortal, setShowCustomerPortal] = useState(false);
  const { showSuccess, showError } = useNotification();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "name") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            officeLat: position.coords.latitude.toFixed(6),
            officeLng: position.coords.longitude.toFixed(6),
          }));
          showSuccess("Location captured successfully!");
        },
        (error) => showError("Failed to get location: " + error.message),
      );
    } else {
      showError("Geolocation is not supported by this browser");
    }
  };

  useEffect(() => {
    handleGetLocation();
  }, []);

  const handleSendOtp = async () => {
    if (!formData.adminMobile) {
      showError("Please enter a mobile number first");
      return;
    }
    setSendingOtp(true);
    try {
      const response = await apiClient.sendOtp(formData.adminMobile);
      setOtpSent(true);
      showSuccess(response.message || "OTP sent successfully!");
    } catch (error: any) {
      showError(error.response?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      showError("Please enter the OTP");
      return;
    }
    setVerifyingOtp(true);
    try {
      const response = await apiClient.verifyOtp(formData.adminMobile, otp);
      setOtpVerified(true);
      showSuccess(response.message || "Mobile number verified successfully!");
    } catch (error: any) {
      showError(error.response?.message || "Invalid or expired OTP");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpVerified) {
      showError("Please verify your mobile number first");
      return;
    }
    setLoading(true);
    try {
      await apiClient.createTenant({
        name: formData.name,
        slug: formData.slug,
        companyName: formData.companyName,
        adminFirstName: formData.adminFirstName,
        adminLastName: formData.adminLastName,
        adminEmail: formData.adminEmail,
        adminPassword: formData.adminPassword,
        adminMobile: formData.adminMobile,
        subscription: {
          plan: formData.plan,
          maxUsers: parseInt(formData.maxUsers.toString()),
          maxForms: parseInt(formData.maxForms.toString()),
        },
        officeLocation: {
          lat: parseFloat(formData.officeLat),
          lng: parseFloat(formData.officeLng),
          radius: parseInt(formData.attendanceRadius.toString()),
        },
        settings: { showCustomerPortal },
      });
      showSuccess("Tenant created successfully!");
      onSuccess();
    } catch (error: any) {
      showError(error.response?.message || "Failed to create tenant");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all";

  const SectionHeader = ({
    icon: Icon,
    title,
    subtitle,
    color = "primary",
  }: any) => (
    <div className="flex items-center gap-3 mb-5">
      <div
        className={`w-9 h-9 rounded-xl bg-${color}-100 dark:bg-${color}-950/40 flex items-center justify-center flex-shrink-0`}
      >
        <Icon
          className={`w-4.5 h-4.5 text-${color}-600 dark:text-${color}-400`}
          style={{ width: 18, height: 18 }}
        />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary-700 to-primary-500 px-6 py-5 flex-shrink-0">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white blur-2xl" />
          </div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Create New Tenant
                </h2>
                <p className="text-primary-200 text-xs mt-0.5">
                  Add a company branch with an admin account
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white/80 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-7">
            {/* ── Tenant Info ── */}
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <SectionHeader
                icon={Building2}
                title="Tenant Information"
                subtitle="Branch identity & URL slug"
              />
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Tenant Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Hyderabad Branch"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Slug (URL) *
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="slug"
                      value={formData.slug}
                      onChange={handleChange}
                      className={`${inputClass} pl-9`}
                      placeholder="hyderabad-branch"
                      pattern="[a-z0-9\-]+"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" /> /focus.com/
                    {formData.slug || "slug"}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Company Name *
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className={`${inputClass} pl-9`}
                    placeholder="Focus Hyderabad Pvt Ltd"
                    required
                  />
                </div>
              </div>
            </div>

            {/* ── Admin Info ── */}
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <SectionHeader
                icon={User}
                title="Admin Account"
                subtitle="Primary administrator for this tenant"
              />

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="adminFirstName"
                    value={formData.adminFirstName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="John"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="adminLastName"
                    value={formData.adminLastName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    name="adminEmail"
                    value={formData.adminEmail}
                    onChange={handleChange}
                    className={`${inputClass} pl-9`}
                    placeholder="admin@company.com"
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="adminPassword"
                    value={formData.adminPassword}
                    onChange={handleChange}
                    className={`${inputClass} pl-9 pr-10`}
                    placeholder="Min 6 characters"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Mobile + OTP */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Mobile Number *
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      name="adminMobile"
                      value={formData.adminMobile}
                      onChange={handleChange}
                      className={`${inputClass} pl-9 ${otpVerified ? "pr-9" : ""}`}
                      placeholder="9876543210"
                      disabled={otpVerified}
                      required
                    />
                    {otpVerified && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  {!otpVerified && !otpSent && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendingOtp || !formData.adminMobile}
                      className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shadow-sm"
                    >
                      {sendingOtp ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : null}
                      {sendingOtp ? "Sending..." : "Send OTP"}
                    </button>
                  )}
                  {otpVerified && (
                    <div className="flex items-center gap-2 px-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-xl font-semibold text-sm whitespace-nowrap">
                      <CheckCircle className="w-4 h-4" /> Verified
                    </div>
                  )}
                </div>

                {otpSent && !otpVerified && (
                  <div className="mt-3 p-4 bg-primary-50 dark:bg-primary-950/20 rounded-xl border border-primary-100 dark:border-primary-900">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Enter the 6-digit OTP sent to your mobile
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) =>
                          setOtp(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="000000"
                        className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 border-2 border-primary-200 dark:border-primary-800 rounded-xl text-center text-lg font-bold tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        maxLength={6}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={verifyingOtp || otp.length < 6}
                        className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
                      >
                        {verifyingOtp ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : null}
                        {verifyingOtp ? "Verifying..." : "Verify"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-xs text-primary-600 dark:text-primary-400 font-semibold underline mt-2 block text-center hover:text-primary-800 dark:hover:text-primary-200 transition-colors"
                    >
                      Didn't receive code? Resend OTP
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Office Location ── */}
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <SectionHeader
                icon={MapPin}
                title="Office Location"
                subtitle="Used for inspector attendance check-in verification"
                color="emerald"
              />

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Latitude *
                  </label>
                  <div className="relative">
                    <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="officeLat"
                      value={formData.officeLat}
                      onChange={handleChange}
                      className={`${inputClass} pl-9`}
                      placeholder="12.9455"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Longitude *
                  </label>
                  <div className="relative">
                    <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="officeLng"
                      value={formData.officeLng}
                      onChange={handleChange}
                      className={`${inputClass} pl-9`}
                      placeholder="78.8754"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Radius (m) *
                  </label>
                  <input
                    type="number"
                    name="attendanceRadius"
                    value={formData.attendanceRadius}
                    onChange={handleChange}
                    className={inputClass}
                    min="10"
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGetLocation}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
              >
                <Navigation className="w-4 h-4" />
                Use Current Location
              </button>

              {formData.officeLat && formData.officeLng && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-mono">
                    {formData.officeLat}, {formData.officeLng} ·{" "}
                    {formData.attendanceRadius}m radius
                  </span>
                </div>
              )}
            </div>

            {/* ── Subscription ── */}
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <SectionHeader
                icon={Crown}
                title="Subscription Plan"
                subtitle="Set limits for this tenant"
                color="violet"
              />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Plan *
                  </label>
                  <select
                    name="plan"
                    value={formData.plan}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> Max Users *
                    </span>
                  </label>
                  <input
                    type="number"
                    name="maxUsers"
                    value={formData.maxUsers}
                    onChange={handleChange}
                    className={inputClass}
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Max Forms *
                    </span>
                  </label>
                  <input
                    type="number"
                    name="maxForms"
                    value={formData.maxForms}
                    onChange={handleChange}
                    className={inputClass}
                    min="1"
                    required
                  />
                </div>
              </div>
            </div>

            {/* ── Customer Portal ── */}
            <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
                  <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    Customer Portal
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Show portal link on tenant's dashboard
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {showCustomerPortal && (
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-1 rounded-lg">
                    Enabled
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowCustomerPortal((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showCustomerPortal ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showCustomerPortal ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-semibold text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                  Creating...
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" /> Create Tenant
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
