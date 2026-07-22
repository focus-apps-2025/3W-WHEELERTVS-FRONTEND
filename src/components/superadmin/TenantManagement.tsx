import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Search,
  Trash2,
  Power,
  Eye as EyeIcon,
  Users,
  FileText,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  BarChart2,
  CheckCircle,
  Phone,
  Shield,
  Globe,
  Crown,
  ChevronDown,
  UserCheck,
  UserX,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { apiClient } from "../../api/client";
import CreateTenantModal from "./CreateTenantModal";
import TenantDetailsModal from "./TenantDetailsModal";
import EditTenantModal from "./EditTenantModal";
import { X, UserPlus, Edit } from "lucide-react";
import SuperAdminUserResponseDashboard from "./SuperAdminUserResponseDashboard";

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  companyName: string;
  isActive: boolean;
  adminId?: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
    lastLogin?: string;
    role: string;
    granularPermissions?: {
      canEditAttendanceTime: boolean;
      canEditInvoices: boolean;
      canEditPricing: boolean;
    };
  }>;
  settings: {
    logo?: string;
    primaryColor?: string;
    companyEmail?: string;
    companyPhone?: string;
    showCustomerPortal?: boolean;
  };
  subscription: {
    plan: string;
    maxUsers: number;
    maxForms: number;
  };
  internalTrackingEnabled?: boolean;
  allowedTenantIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export default function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadingTenantId, setUploadingTenantId] = useState<string | null>(
    null,
  );
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: { percentage: number; timeRemaining?: number };
  }>({});
  const { showSuccess, showError } = useNotification();
  const { tenant: currentTenant, updateTenant } = useAuth();
  const [activeTab, setActiveTab] = useState<"tenants" | "user-response">(
    "tenants",
  );
  const [showAddAdminForm, setShowAddAdminForm] = useState<string | null>(null);
  const [newAdminData, setNewAdminData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    mobile: "",
  });
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<{
    tenantId: string;
    admin: any;
  } | null>(null);
  const [editAdminData, setEditAdminData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    newPassword: "",
    confirmNewPassword: "",
    mobile: "",
  });
  const [deletingAdmin, setDeletingAdmin] = useState<string | null>(null);
  const [updatingAdmin, setUpdatingAdmin] = useState<string | null>(null);
  const [expandedAdmins, setExpandedAdmins] = useState<Set<string>>(new Set());
  const [showInternalTrackingModal, setShowInternalTrackingModal] = useState(false);
  const [trackingTenant, setTrackingTenant] = useState<Tenant | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [selectedAllowedTenants, setSelectedAllowedTenants] = useState<string[]>([]);
  const [savingTracking, setSavingTracking] = useState(false);
  const [updatingPermissions, setUpdatingPermissions] = useState<{ [adminId: string]: boolean }>({});
  const [localCheckboxState, setLocalCheckboxState] = useState<{ [key: string]: boolean }>({});

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.isActive).length,
    inactive: tenants.filter((t) => !t.isActive).length,
  };

  const toggleAdminsExpanded = (tenantId: string) => {
    setExpandedAdmins((prev) => {
      const next = new Set(prev);
      next.has(tenantId) ? next.delete(tenantId) : next.add(tenantId);
      return next;
    });
  };

  const handleInternalTrackingClick = (tenant: Tenant) => {
    setTrackingTenant(tenant);
    setTrackingEnabled(tenant.internalTrackingEnabled || false);
    const allowed = Array.isArray(tenant.allowedTenantIds)
      ? tenant.allowedTenantIds.map((id: any) => id.toString ? id.toString() : id)
      : [];
    setSelectedAllowedTenants(allowed);
    setShowInternalTrackingModal(true);
  };

  const handleSaveInternalTracking = async () => {
    if (!trackingTenant) return;
    setSavingTracking(true);
    try {
      await apiClient.updateTenantInternalTracking(trackingTenant._id, {
        internalTrackingEnabled: trackingEnabled,
        allowedTenantIds: trackingEnabled ? selectedAllowedTenants : [],
      });
      const updatedTenant: Tenant = {
        ...trackingTenant,
        internalTrackingEnabled: trackingEnabled,
        allowedTenantIds: trackingEnabled ? selectedAllowedTenants : [],
      };
      setTenants((prev) =>
        prev.map((t) => (t._id === trackingTenant._id ? updatedTenant : t)),
      );
      if (currentTenant?._id === trackingTenant._id) {
        updateTenant(updatedTenant);
      }
      showSuccess(
        trackingEnabled
          ? "Internal Tracking enabled successfully"
          : "Internal Tracking disabled successfully"
      );
      setShowInternalTrackingModal(false);
      setTrackingTenant(null);
    } catch (error: any) {
      showError(error?.message || "Failed to update Internal Tracking settings");
    } finally {
      setSavingTracking(false);
    }
  };

  const toggleAllowedTenant = (tenantId: string) => {
    setSelectedAllowedTenants((prev) => {
      if (prev.includes(tenantId)) {
        return prev.filter((id) => id !== tenantId);
      }
      return [...prev, tenantId];
    });
  };

  const handleAddAdminClick = (tenantId: string) => {
    setShowAddAdminForm(tenantId);
    setNewAdminData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      mobile: "",
    });
    setOtp("");
    setOtpSent(false);
    setOtpVerified(false);
  };

  const handleCancelAddAdmin = () => {
    setShowAddAdminForm(null);
    setNewAdminData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      mobile: "",
    });
    setOtp("");
    setOtpSent(false);
    setOtpVerified(false);
  };

  const handleNewAdminChange = (field: string, value: string) =>
    setNewAdminData((prev) => ({ ...prev, [field]: value }));

  const handleSendOtp = async () => {
    if (!newAdminData.mobile) {
      showError("Please enter mobile number first");
      return;
    }
    setSendingOtp(true);
    try {
      const response = await apiClient.sendOtp(newAdminData.mobile);
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
      showError("Please enter OTP");
      return;
    }
    setVerifyingOtp(true);
    try {
      const response = await apiClient.verifyOtp(newAdminData.mobile, otp);
      setOtpVerified(true);
      showSuccess(response.message || "Mobile number verified successfully!");
    } catch (error: any) {
      showError(error.response?.message || "Invalid OTP");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleAddAdminSubmit = async (tenantId: string) => {
    if (
      !newAdminData.firstName ||
      !newAdminData.lastName ||
      !newAdminData.email ||
      !newAdminData.password
    ) {
      showError("All fields are required");
      return;
    }
    if (newAdminData.password !== newAdminData.confirmPassword) {
      showError("Passwords don't match");
      return;
    }
    if (newAdminData.password.length < 6) {
      showError("Password must be at least 6 characters long");
      return;
    }
    setAddingAdmin(tenantId);
    try {
      const payload: any = {
        firstName: newAdminData.firstName,
        lastName: newAdminData.lastName,
        email: newAdminData.email,
        password: newAdminData.password,
      };
      if (otpVerified && newAdminData.mobile) {
        payload.mobile = newAdminData.mobile;
      }
      await apiClient.addAdminToTenant(tenantId, payload);
      fetchTenants();
    } catch (error: any) {
      showError(error.response?.message || "Failed to add admin");
    } finally {
      setAddingAdmin(null);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [searchTerm, statusFilter]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getTenants(searchTerm, statusFilter, "paid");
      setTenants(data.tenants);
    } catch (error: any) {
      showError(error.response?.message || "Failed to fetch tenants");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (tenantId: string) => {
    try {
      await apiClient.toggleTenantStatus(tenantId);
      showSuccess("Tenant status updated successfully");
      fetchTenants();
    } catch (error: any) {
      showError(error.response?.message || "Failed to toggle tenant status");
    }
  };

  const handleToggleCustomerPortal = async (
    tenantId: string,
    currentValue: boolean,
  ) => {
    try {
      const target = tenants.find((item) => item._id === tenantId);
      const settings = {
        ...(target?.settings || {}),
        showCustomerPortal: !currentValue,
      };
      const response = await apiClient.updateTenant(tenantId, { settings });
      const updatedTenant: Tenant =
        response?.tenant ?? ({ ...target, settings } as Tenant);
      setTenants((prev) =>
        prev.map((t) => (t._id === tenantId ? { ...t, settings } : t)),
      );
      if (currentTenant?._id === tenantId) updateTenant(updatedTenant);
      showSuccess(
        `Customer Portal ${!currentValue ? "enabled" : "disabled"} successfully`,
      );
    } catch (error: any) {
      showError(error?.message || "Failed to update Customer Portal setting");
    }
  };

  const handleViewDetails = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowDetailsModal(true);
  };
  const handleTenantCreated = () => {
    setShowTenantModal(false);
    fetchTenants();
  };

  const handleTenantLogoChange = async (
    tenantId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadingTenantId(tenantId);
    setUploadProgress({});
    try {
      const uploadResult = await apiClient.uploadFile(
        file,
        "logo",
        undefined,
        (progress) => {
          setUploadProgress((prev) => ({
            ...prev,
            [tenantId]: {
              percentage: progress.percentage,
              timeRemaining: progress.timeRemaining,
            },
          }));
        },
      );
      const logoUrl =
        apiClient.resolveUploadedFileUrl(uploadResult) + "?t=" + Date.now();
      const target = tenants.find((item) => item._id === tenantId);
      const settings = { ...(target?.settings || {}), logo: logoUrl };
      await apiClient.updateTenant(tenantId, { settings });
      setTenants((prev) =>
        prev.map((t) => (t._id === tenantId ? { ...t, settings } : t)),
      );
      showSuccess("Tenant logo updated successfully");
    } catch (error: any) {
      showError(
        error?.message || "Failed to upload tenant logo",
        "Upload Failed",
      );
    } finally {
      setUploadingTenantId(null);
      setUploadProgress((prev) => {
        const updated = { ...prev };
        delete updated[tenantId];
        return updated;
      });
      input.value = "";
    }
  };

  const handleTenantLogoRemove = async (tenantId: string) => {
    setUploadingTenantId(tenantId);
    try {
      const target = tenants.find((item) => item._id === tenantId);
      const settings = { ...(target?.settings || {}), logo: "" };
      await apiClient.updateTenant(tenantId, { settings });
      setTenants((prev) =>
        prev.map((t) => (t._id === tenantId ? { ...t, settings } : t)),
      );
      showSuccess("Tenant logo removed");
    } catch (error: any) {
      showError(
        error?.message || "Failed to remove tenant logo",
        "Remove Failed",
      );
    } finally {
      setUploadingTenantId(null);
    }
  };

  const handleEditAdminClick = (tenantId: string, admin: any) => {
    setEditingAdmin({ tenantId, admin });
    setEditAdminData({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      newPassword: "",
      confirmNewPassword: "",
      mobile: "",
    });
  };

  const handleCancelEdit = () => {
    setEditingAdmin(null);
    setEditAdminData({
      firstName: "",
      lastName: "",
      email: "",
      newPassword: "",
      confirmNewPassword: "",
      mobile: "",
    });
  };

  const handleEditAdminChange = (field: string, value: string) =>
    setEditAdminData((prev) => ({ ...prev, [field]: value }));

  const handleEditAdminSubmit = async () => {
    if (!editingAdmin) return;
    if (
      !editAdminData.firstName ||
      !editAdminData.lastName ||
      !editAdminData.email
    ) {
      showError("All fields are required");
      return;
    }
    if (editAdminData.newPassword) {
      if (editAdminData.newPassword.length < 6) {
        showError("Password must be at least 6 characters long");
        return;
      }
      if (editAdminData.newPassword !== editAdminData.confirmNewPassword) {
        showError("Passwords don't match");
        return;
      }
    }
    setUpdatingAdmin(editingAdmin.admin._id);
    try {
      await apiClient.updateUser(editingAdmin.admin._id, {
        firstName: editAdminData.firstName,
        lastName: editAdminData.lastName,
        email: editAdminData.email,
      });
      if (editAdminData.newPassword) {
        await apiClient.resetUserPassword(
          editingAdmin.admin._id,
          editAdminData.newPassword,
        );
        showSuccess("Admin updated and password reset successfully");
      } else {
        showSuccess("Admin updated successfully");
      }
      setEditingAdmin(null);
      setEditAdminData({
        firstName: "",
        lastName: "",
        email: "",
        newPassword: "",
        confirmNewPassword: "",
        mobile: "",
      });
      fetchTenants();
    } catch (error: any) {
      showError(error.response?.message || "Failed to update admin");
    } finally {
      setUpdatingAdmin(null);
    }
  };

  const handleToggleAdminStatus = async (tenantId: string, admin: any) => {
    setUpdatingAdmin(admin._id);
    try {
      await apiClient.updateUser(admin._id, { isActive: !admin.isActive });
      showSuccess(
        `Admin ${!admin.isActive ? "activated" : "deactivated"} successfully`,
      );
      fetchTenants();
    } catch (error: any) {
      showError(error.response?.message || "Failed to update admin status");
    } finally {
      setUpdatingAdmin(null);
    }
  };

  const handleDeleteAdmin = async (
    tenantId: string,
    adminId: string,
    adminName: string,
  ) => {
    if (
      !window.confirm(
        `Are you sure you want to remove ${adminName}? This action cannot be undone.`,
      )
    )
      return;
    setDeletingAdmin(adminId);
    try {
      await apiClient.removeAdminFromTenant(tenantId, adminId);
      showSuccess("Admin removed successfully");
      fetchTenants();
    } catch (error: any) {
      showError(error.response?.message || "Failed to remove admin");
    } finally {
      setDeletingAdmin(null);
    }
  };

  const handlePermissionToggle = async (adminId: string, permissionKey: string, currentValue: boolean) => {
    // Optimistically update local state for immediate visual feedback
    const checkboxKey = `${adminId}-${permissionKey}`;
    const newValue = !currentValue;
    setLocalCheckboxState((prev) => ({ ...prev, [checkboxKey]: newValue }));

    setUpdatingPermissions((prev) => ({ ...prev, [adminId]: true }));
    try {
      const permissionKeyMap: Record<string, string> = {
        canEditAttendanceTime: 'canEditAttendanceTime',
        canEditInvoices: 'canEditInvoices',
        canEditPricing: 'canEditPricing',
      };

      const updatePayload: any = { [permissionKeyMap[permissionKey]]: newValue };
      await apiClient.updateGranularPermissions(adminId, updatePayload);
      showSuccess(`${permissionKey === 'canEditAttendanceTime' ? 'Attendance' : permissionKey === 'canEditInvoices' ? 'Invoice' : 'Pricing'} edit permission ${newValue ? 'granted' : 'revoked'} successfully`);

      // Update local tenant state instead of refetching to preserve checkbox state
      setTenants((prev) =>
        prev.map((tenant) => ({
          ...tenant,
          adminId: tenant.adminId?.map((admin) =>
            admin._id === adminId
              ? {
                ...admin,
                granularPermissions: {
                  canEditAttendanceTime: admin.granularPermissions?.canEditAttendanceTime ?? false,
                  canEditInvoices: admin.granularPermissions?.canEditInvoices ?? false,
                  canEditPricing: admin.granularPermissions?.canEditPricing ?? false,
                  [permissionKeyMap[permissionKey]]: newValue,
                },
              }
              : admin
          ),
        }))
      );
    } catch (error: any) {
      // Revert local state on error
      setLocalCheckboxState((prev) => ({ ...prev, [checkboxKey]: currentValue }));
      showError(error.response?.message || "Failed to update permission");
    } finally {
      setUpdatingPermissions((prev) => ({ ...prev, [adminId]: false }));
    }
  };

  const handleDeleteTenant = (tenantId: string, tenantName: string) => {
    setTenantToDelete({ id: tenantId, name: tenantName });
    setShowDeleteModal(true);
  };

  const confirmDeleteTenant = async () => {
    if (!tenantToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteTenant(tenantToDelete.id);
      showSuccess("Tenant and all associated data deleted successfully");
      setShowDeleteModal(false);
      setTenantToDelete(null);
      fetchTenants();
    } catch (error: any) {
      showError(error.response?.message || "Failed to delete tenant");
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-full p-6 space-y-6">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 p-8 shadow-xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white blur-2xl" />
          </div>
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-primary-200 text-sm font-semibold uppercase tracking-widest mb-1">
                  Super Admin
                </p>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Tenant Management
                </h1>
                <p className="text-primary-200 mt-1">
                  Manage company branches, admins & subscriptions
                </p>
              </div>
            </div>
            {activeTab === "tenants" && (
              <button
                onClick={() => {
                  setModalMode("create");
                  setEditingTenant(null);
                  setShowTenantModal(true);
                }}
                className="flex items-center gap-3 bg-white text-primary-700 font-bold px-6 py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:bg-primary-50 transition-all duration-200 min-w-fit"
              >
                <Plus className="w-5 h-5" />
                Create Tenant
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-1.5 shadow-sm inline-flex gap-1">
          {[
            { id: "tenants", label: "Tenants", icon: Building2 },
            {
              id: "user-response",
              label: "User Response Dashboard",
              icon: BarChart2,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === tab.id
                ? "bg-primary-600 text-white shadow-md"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "user-response" ? (
          <SuperAdminUserResponseDashboard />
        ) : (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: "Total Tenants",
                  value: stats.total,
                  icon: Building2,
                  color: "from-violet-500 to-purple-600",
                  bg: "bg-violet-50 dark:bg-violet-950/30",
                  text: "text-violet-700 dark:text-violet-300",
                  border: "border-violet-100 dark:border-violet-900",
                },
                {
                  label: "Active",
                  value: stats.active,
                  icon: UserCheck,
                  color: "from-emerald-500 to-green-600",
                  bg: "bg-emerald-50 dark:bg-emerald-950/30",
                  text: "text-emerald-700 dark:text-emerald-300",
                  border: "border-emerald-100 dark:border-emerald-900",
                },
                {
                  label: "Inactive",
                  value: stats.inactive,
                  icon: UserX,
                  color: "from-rose-500 to-red-600",
                  bg: "bg-rose-50 dark:bg-rose-950/30",
                  text: "text-rose-700 dark:text-rose-300",
                  border: "border-rose-100 dark:border-rose-900",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`${stat.bg} rounded-2xl border ${stat.border} p-5 flex items-center gap-4`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md flex-shrink-0`}
                  >
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className={`text-3xl font-black ${stat.text}`}>
                      {stat.value}
                    </p>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tenants by name, slug or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder:text-gray-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all min-w-[160px]"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {/* Tenants Grid */}
            {loading ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-16 text-center">
                <div className="w-14 h-14 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="font-semibold text-gray-700 dark:text-gray-300">
                  Loading tenants...
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Fetching your tenant data
                </p>
              </div>
            ) : tenants.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-16 text-center">
                <div className="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-10 h-10 text-primary-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No tenants yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Create your first tenant to start managing company branches.
                </p>
                <button
                  onClick={() => {
                    setModalMode("create");
                    setEditingTenant(null);
                    setShowTenantModal(true);
                  }}
                  className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all"
                >
                  <Plus className="w-5 h-5" /> Create First Tenant
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {tenants.map((tenant) => {
                  const tenantLogo = tenant.settings?.logo;
                  const adminsExpanded = expandedAdmins.has(tenant._id);

                  return (
                    <div
                      key={tenant._id}
                      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
                    >
                      {/* Card Top Bar — status accent */}
                      <div
                        className={`h-1.5 w-full ${tenant.isActive ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-gradient-to-r from-gray-300 to-gray-400"}`}
                      />

                      <div className="p-6">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-3 mb-5">
                          <div className="flex items-center gap-4">
                            {/* Logo / Avatar */}
                            <div className="w-14 h-14 rounded-xl bg-primary-50 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                              {tenantLogo ? (
                                <img
                                  src={tenantLogo}
                                  alt={tenant.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <span className="text-lg font-black text-primary-600 dark:text-primary-400">
                                  {getInitials(tenant.name)}
                                </span>
                              )}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                {tenant.name}
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {tenant.companyName}
                              </p>
                              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-md mt-1 inline-block">
                                /{tenant.slug}
                              </code>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${tenant.isActive
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                  }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${tenant.isActive ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`}
                                />
                                {tenant.isActive ? "Active" : "Inactive"}
                              </span>
                              <button
                                onClick={() =>
                                  handleDeleteTenant(tenant._id, tenant.name)
                                }
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                                title="Delete tenant"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(tenant.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Subscription Badges */}
                        <div className="flex items-center gap-2 mb-5 flex-wrap">
                          <span className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900 px-3 py-1.5 rounded-lg text-xs font-bold capitalize">
                            <Crown className="w-3 h-3" />
                            {tenant.subscription.plan}
                          </span>
                          <span className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900 px-3 py-1.5 rounded-lg text-xs font-semibold">
                            <Users className="w-3 h-3" />
                            {tenant.subscription.maxUsers} users
                          </span>
                          <span className="flex items-center gap-1.5 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900 px-3 py-1.5 rounded-lg text-xs font-semibold">
                            <FileText className="w-3 h-3" />
                            {tenant.subscription.maxForms} forms
                          </span>
                          {tenant.settings?.showCustomerPortal && (
                            <span className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 px-3 py-1.5 rounded-lg text-xs font-semibold">
                              <Globe className="w-3 h-3" />
                              Portal Active
                            </span>
                          )}
                        </div>

                        {/* Admins Collapsible Section */}
                        <div className="mb-5 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                          <button
                            onClick={() => toggleAdminsExpanded(tenant._id)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-primary-500" />
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Administrators
                              </span>
                              <span className="bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold px-2 py-0.5 rounded-full">
                                {tenant.adminId?.length || 0}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddAdminClick(tenant._id);
                                }}
                                className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                              >
                                <UserPlus className="w-3 h-3" /> Add
                              </button>
                              <ChevronDown
                                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${adminsExpanded ? "rotate-180" : ""}`}
                              />
                            </div>
                          </button>

                          {adminsExpanded && (
                            <div className="p-3 space-y-2 bg-white dark:bg-gray-900">
                              {/* Existing Administrators List */}
                              {Array.isArray(tenant.adminId) && tenant.adminId.length > 0 ? (
                                <div className="space-y-2 mb-3">
                                  {tenant.adminId.map((admin: any) => (
                                    <div key={admin._id || admin} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                            {admin.firstName?.[0]}{admin.lastName?.[0]}
                                          </span>
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {admin.firstName} {admin.lastName}
                                          </p>
                                          <p className="text-xs text-gray-500">{admin.email}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-end gap-1">
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="checkbox"
                                              checked={(localCheckboxState[`${admin._id}-canEditAttendanceTime`] ?? admin.granularPermissions?.canEditAttendanceTime) || false}
                                              onChange={() => {
                                                const currentLocalValue = localCheckboxState[`${admin._id}-canEditAttendanceTime`];
                                                const currentServerValue = admin.granularPermissions?.canEditAttendanceTime || false;
                                                const currentValue = currentLocalValue !== undefined ? currentLocalValue : currentServerValue;
                                                handlePermissionToggle(admin._id, 'canEditAttendanceTime', currentValue);
                                              }}
                                              disabled={updatingPermissions[admin._id] || false}
                                              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50 cursor-pointer"
                                            />
                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 select-none">
                                              Can Edit Attendance, Swap, Bulk Import Response, Select All options.
                                            </span>
                                          </div>
                                        </div>
                                        {updatingPermissions[admin._id] && (
                                          <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                                        )}
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => handleEditAdminClick(tenant._id, admin)}
                                            disabled={updatingAdmin === (admin._id || admin)}
                                            className="p-1 text-gray-400 hover:text-primary-600 rounded"
                                            title="Edit admin"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteAdmin(tenant._id, admin._id || admin, `${admin.firstName} ${admin.lastName}`)}
                                            disabled={deletingAdmin === (admin._id || admin)}
                                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                                            title="Remove admin"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : showAddAdminForm !== tenant._id && (
                                <p className="text-xs text-gray-400 mb-3">No administrators found</p>
                              )}
                              {/* Add Admin Form */}
                              {showAddAdminForm === tenant._id && (
                                <div className="bg-primary-50 dark:bg-primary-950/20 rounded-xl p-4 border border-primary-200 dark:border-primary-900 mb-3">
                                  <div className="flex items-center justify-between mb-4">
                                    <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                                      Add Administrator
                                    </h5>
                                    <button
                                      onClick={handleCancelAddAdmin}
                                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                        First Name *
                                      </label>
                                      <input
                                        type="text"
                                        value={newAdminData.firstName}
                                        onChange={(e) =>
                                          handleNewAdminChange(
                                            "firstName",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                                        placeholder="First name"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                        Last Name *
                                      </label>
                                      <input
                                        type="text"
                                        value={newAdminData.lastName}
                                        onChange={(e) =>
                                          handleNewAdminChange(
                                            "lastName",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                                        placeholder="Last name"
                                      />
                                    </div>
                                  </div>
                                  <div className="mb-2.5">
                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                      Email *
                                    </label>
                                    <input
                                      type="email"
                                      value={newAdminData.email}
                                      onChange={(e) =>
                                        handleNewAdminChange(
                                          "email",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                                      placeholder="admin@company.com"
                                    />
                                  </div>
                                  <div className="mb-2.5">
                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                      Mobile
                                    </label>
                                    <div className="flex gap-2">
                                      <div className="relative flex-1">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                        <input
                                          type="tel"
                                          value={newAdminData.mobile}
                                          onChange={(e) =>
                                            handleNewAdminChange("mobile", e.target.value)
                                          }
                                          disabled={otpSent && !otpVerified}
                                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-all disabled:opacity-60"
                                          placeholder="Mobile number"
                                        />
                                      </div>
                                      {!otpVerified && newAdminData.mobile && (
                                        <button
                                          type="button"
                                          onClick={handleSendOtp}
                                          disabled={sendingOtp || !newAdminData.mobile}
                                          className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                                        >
                                          {sendingOtp ? (
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                          ) : (
                                            "Send OTP"
                                          )}
                                        </button>
                                      )}
                                      {otpVerified && (
                                        <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 dark:border-emerald-900 rounded-lg">
                                          <CheckCircle className="w-3.5 h-3.5" />
                                          <span className="text-xs font-bold">Verified</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {otpSent && !otpVerified && (
                                    <div className="mb-2.5 p-3 bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-900 rounded-xl">
                                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Enter 6-digit OTP
                                      </label>
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          maxLength={6}
                                          value={otp}
                                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                          className="flex-1 px-3 py-2 border-2 border-primary-200 dark:border-primary-800 rounded-lg text-center text-lg font-bold tracking-[0.4em] bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                                          placeholder="000000"
                                        />
                                        <button
                                          type="button"
                                          onClick={handleVerifyOtp}
                                          disabled={verifyingOtp || otp.length !== 6}
                                          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                                        >
                                          {verifyingOtp ? (
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                          ) : (
                                            "Verify"
                                          )}
                                        </button>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={handleSendOtp}
                                        className="text-xs text-primary-600 dark:text-primary-400 font-semibold underline mt-2 block text-center"
                                      >
                                        Resend OTP
                                      </button>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                        Password *
                                      </label>
                                      <input
                                        type="password"
                                        value={newAdminData.password}
                                        onChange={(e) =>
                                          handleNewAdminChange(
                                            "password",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-all"
                                        placeholder="Min 6 characters"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                        Confirm *
                                      </label>
                                      <input
                                        type="password"
                                        value={newAdminData.confirmPassword}
                                        onChange={(e) =>
                                          handleNewAdminChange(
                                            "confirmPassword",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-all"
                                        placeholder="Confirm password"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() =>
                                        handleAddAdminSubmit(tenant._id)
                                      }
                                      disabled={addingAdmin === tenant._id}
                                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold py-2.5 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                    >
                                      {addingAdmin === tenant._id ? (
                                        <>
                                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Adding...
                                        </>
                                      ) : (
                                        <>
                                          <UserPlus className="w-4 h-4" /> Add Admin
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={handleCancelAddAdmin}
                                      className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Customer Portal Toggle */}
                        <div className="mb-5 flex items-center justify-between p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900">
                          <div className="flex items-center gap-3">
                            <Globe className="w-4 h-4 text-indigo-500" />
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                Customer Portal
                              </p>
                              {tenant.settings?.showCustomerPortal ? (
                                <p className="text-[10px] text-indigo-500 font-mono mt-0.5 truncate max-w-[200px]">
                                  /{tenant.slug}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400">
                                  Disabled
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleCustomerPortal(
                                tenant._id,
                                tenant.settings?.showCustomerPortal ?? false,
                              )
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${tenant.settings?.showCustomerPortal ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${tenant.settings?.showCustomerPortal ? "translate-x-6" : "translate-x-1"}`}
                            />
                          </button>
                        </div>

                        {/* Internal Tracking Toggle */}
                        <div className="mb-5 flex items-center justify-between p-4 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900">
                          <div className="flex items-center gap-3">
                            <EyeIcon className="w-4 h-4 text-violet-500" />
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                Internal Tracking
                              </p>
                              <p className="text-xs text-gray-400">
                                {tenant.internalTrackingEnabled
                                  ? `Access granted to ${(tenant.allowedTenantIds?.length || 0)} tenant${(tenant.allowedTenantIds?.length || 0) !== 1 ? 's' : ''}`
                                  : "Disabled"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {tenant.internalTrackingEnabled && (
                              <button
                                type="button"
                                onClick={() => handleInternalTrackingClick(tenant)}
                                className="px-2.5 py-1 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-bold rounded-lg hover:bg-violet-200 dark:hover:bg-violet-900/60 transition-all"
                              >
                                Configure
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                handleInternalTrackingClick(tenant);
                              }}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${tenant.internalTrackingEnabled ? "bg-violet-600" : "bg-gray-200 dark:bg-gray-700"}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${tenant.internalTrackingEnabled ? "translate-x-6" : "translate-x-1"}`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => handleViewDetails(tenant)}
                            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-sm"
                          >
                            <EyeIcon className="w-4 h-4" />
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              setEditingTenant(tenant);
                              setShowEditModal(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-sm"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(tenant._id)}
                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border ${tenant.isActive
                              ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-950/50"
                              : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                              }`}
                            title={tenant.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className="w-4 h-4" />
                            {tenant.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        {showTenantModal && (
          <CreateTenantModal
            onClose={() => setShowTenantModal(false)}
            onSuccess={handleTenantCreated}
          />
        )}
        {showDetailsModal && selectedTenant && (
          <TenantDetailsModal
            tenant={selectedTenant}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedTenant(null);
            }}
            onUpdate={fetchTenants}
            onEditClick={() => {
              setShowDetailsModal(false);
              setEditingTenant(selectedTenant);
              setShowEditModal(true);
              setSelectedTenant(null);
            }}
          />
        )}
        {showEditModal && editingTenant && (
          <EditTenantModal
            tenant={editingTenant}
            onClose={() => {
              setShowEditModal(false);
              setEditingTenant(null);
            }}
            onSuccess={() => {
              setShowEditModal(false);
              setEditingTenant(null);
              fetchTenants();
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && tenantToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-red-100 dark:border-red-900/30 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-red-400 to-rose-500" />
              <div className="p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Delete Tenant?
                    </h3>
                    <p className="text-sm text-red-500 font-medium">
                      This cannot be undone
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  You're about to permanently delete{" "}
                  <span className="font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                    {tenantToDelete.name}
                  </span>{" "}
                  and all associated data.
                </p>
                <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 border border-red-100 dark:border-red-900/30 mb-6 space-y-1.5">
                  {[
                    "All users and their profiles",
                    "All forms and follow-up structures",
                    "All responses and analytics",
                    "All parameters and invites",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400"
                    >
                      <Trash2 className="w-3 h-3 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setTenantToDelete(null);
                    }}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteTenant}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" /> Delete Tenant
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Internal Tracking Configuration Modal */}
        {showInternalTrackingModal && trackingTenant && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full border border-violet-100 dark:border-violet-900/30 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-600" />
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
                      <EyeIcon className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Internal Tracking
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Configure for {trackingTenant.companyName}
                      </p>
                    </div>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${trackingEnabled ? "bg-violet-600" : "bg-gray-200 dark:bg-gray-700"}`}>
                    <button
                      type="button"
                      onClick={() => setTrackingEnabled(!trackingEnabled)}
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${trackingEnabled ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </div>
                </div>

                {trackingEnabled && (
                  <div className="mb-5">
                    <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-3">
                      Select Tenants to Grant Access
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      Choose which tenants {trackingTenant.companyName} can view data from:
                    </p>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
                      {tenants
                        .filter((t: any) => t._id !== trackingTenant._id)
                        .map((t: any) => (
                          <label
                            key={t._id}
                            className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAllowedTenants.includes(t._id)}
                              onChange={() => toggleAllowedTenant(t._id)}
                              className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                            />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {t.companyName}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              /{t.slug}
                            </span>
                          </label>
                        ))}
                      {tenants.filter((t: any) => t._id !== trackingTenant._id).length === 0 && (
                        <p className="text-xs text-gray-400 p-4 text-center">No other tenants available</p>
                      )}
                    </div>
                    {selectedAllowedTenants.length === 0 && trackingEnabled && (
                      <p className="text-xs text-amber-600 mt-2 font-semibold">
                        Please select at least one tenant
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowInternalTrackingModal(false);
                      setTrackingTenant(null);
                    }}
                    disabled={savingTracking}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveInternalTracking}
                    disabled={savingTracking || (trackingEnabled && selectedAllowedTenants.length === 0)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingTracking ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                        Saving...
                      </>
                    ) : (
                      "Save Settings"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}