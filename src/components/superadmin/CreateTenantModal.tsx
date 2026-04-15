import React, { useState } from "react";
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
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const { showSuccess, showError } = useNotification();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Auto-generate slug from name
    if (name === "name") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setFormData((prev) => ({
        ...prev,
        slug,
      }));
    }
  };

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
        subscription: {
          plan: formData.plan,
          maxUsers: parseInt(formData.maxUsers.toString()),
          maxForms: parseInt(formData.maxForms.toString()),
        },
      });

      showSuccess("Tenant created successfully!");
      onSuccess();
    } catch (error: any) {
      showError(error.response?.message || "Failed to create tenant");
      console.error("Error creating tenant:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-primary-900">
                Create New Tenant
              </h2>
              <p className="text-sm text-primary-600">
                Add a new company branch with admin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-primary-400 hover:text-primary-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Tenant Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-primary-900 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-primary-600" />
              Tenant Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Tenant Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Hyderabad Branch"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Slug (URL) *
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary-400" />
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    className="input-field pl-10"
                    placeholder="hyderabad-branch"
                    pattern="[a-z0-9\-]+"
                    required
                  />
                </div>
                <p className="text-xs text-primary-500 mt-1">
                  URL: /focus.com/{formData.slug || "slug"}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Company Name *
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary-400" />
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="Focus Hyderabad Pvt Ltd"
                  required
                />
              </div>
            </div>
          </div>

          {/* Admin Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-primary-900 flex items-center">
              <User className="w-5 h-5 mr-2 text-primary-600" />
              Admin Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  name="adminFirstName"
                  value={formData.adminFirstName}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="John"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="adminLastName"
                  value={formData.adminLastName}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary-400" />
                <input
                  type="email"
                  name="adminEmail"
                  value={formData.adminEmail}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="admin@hyderabad.focus.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="adminPassword"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary-400 hover:text-primary-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-primary-500 mt-1">
                Minimum 6 characters
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Admin Mobile Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary-400" />
                  <input
                    type="tel"
                    name="adminMobile"
                    value={formData.adminMobile}
                    onChange={handleChange}
                    className="input-field pl-10"
                    placeholder="9876543210"
                    disabled={otpVerified}
                    required
                  />
                  {otpVerified && (
                    <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500" />
                  )}
                </div>
              </div>

              <div className="flex items-end pb-1">
                {!otpSent && !otpVerified && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || !formData.adminMobile}
                    className="btn-secondary w-full py-2.5"
                  >
                    {sendingOtp ? "Sending..." : "Verify Mobile No."}
                  </button>
                )}
                {otpSent && !otpVerified && (
                  <>
                    <div className="flex space-x-2 w-full">
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter OTP"
                        className="input-field flex-1"
                        maxLength={6}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={verifyingOtp || otp.length < 6}
                        className="btn-primary"
                      >
                        {verifyingOtp ? "..." : "Verify"}
                      </button>
                    </div>
                    <p className="text-[10px] text-primary-600 dark:text-primary-400 mt-2 text-center font-medium">
                      Didn't receive code?{" "}
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="underline font-bold hover:text-primary-800 dark:hover:text-primary-200"
                      >
                        Resend OTP
                      </button>
                    </p>
                  </>
                )}
                {otpVerified && (
                  <div className="w-full py-2.5 text-center text-green-600 font-medium flex items-center justify-center bg-green-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Verified
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div className="space-y-4">
            <h3 className="font-medium text-primary-900">Subscription Plan</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Plan *
                </label>
                <select
                  name="plan"
                  value={formData.plan}
                  onChange={handleChange}
                  className="input-field"
                  required
                >
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Max Users *
                </label>
                <input
                  type="number"
                  name="maxUsers"
                  value={formData.maxUsers}
                  onChange={handleChange}
                  className="input-field"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Max Forms *
                </label>
                <input
                  type="number"
                  name="maxForms"
                  value={formData.maxForms}
                  onChange={handleChange}
                  className="input-field"
                  min="1"
                  required
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-neutral-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <div className="flex items-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Creating...
                </div>
              ) : (
                "Create Tenant"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
