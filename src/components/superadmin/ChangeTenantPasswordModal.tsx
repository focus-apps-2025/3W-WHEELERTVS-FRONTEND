import React, { useState } from "react";
import { X, Eye, EyeOff, Lock, Check, AlertCircle } from "lucide-react";
import { apiClient } from "../../api/client";
import { useNotification } from "../../context/NotificationContext";

interface ChangeTenantPasswordModalProps {
  tenant: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChangeTenantPasswordModal({
  tenant,
  onClose,
  onSuccess,
}: ChangeTenantPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useNotification();

  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return "Password must be at least 6 characters long";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await apiClient.resetUserPassword(tenant.adminId._id, newPassword);
      setSuccess(true);
      showSuccess("Password changed successfully!");

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error: any) {
      const errorMessage =
        error.response?.message || error.message || "Failed to change password";
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Lock className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-primary-900">
                Change Admin Password
              </h3>
              <p className="text-sm text-primary-600">
                {tenant.adminId.firstName} {tenant.adminId.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-primary-400 hover:text-primary-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">
                Password changed successfully!
              </p>
            </div>
          )}

          {/* Info Message */}
          <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
            <p className="text-sm text-primary-700">
              As a superadmin, you can change the tenant admin's password
              without requiring their current password.
            </p>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-primary-700">
              New Password *
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field pr-10"
                placeholder="Enter new password"
                required
                disabled={success}
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-primary-400 hover:text-primary-600"
              >
                {showNewPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-primary-700">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field pr-10"
                placeholder="Confirm new password"
                required
                disabled={success}
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-primary-400 hover:text-primary-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="p-3 bg-neutral-50 rounded-lg">
            <p className="text-xs font-medium text-primary-700 mb-2">
              Password Requirements:
            </p>
            <ul className="text-xs text-primary-600 space-y-1">
              <li className="flex items-center">
                <span className="w-1 h-1 bg-primary-400 rounded-full mr-2"></span>
                At least 6 characters long
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading || success}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || success}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Changing...
                </div>
              ) : success ? (
                <div className="flex items-center">
                  <Check className="w-4 h-4 mr-2" />
                  Changed
                </div>
              ) : (
                "Change Password"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
