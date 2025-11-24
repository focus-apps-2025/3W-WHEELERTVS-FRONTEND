import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Search,
  Trash2,
  Power,
  Eye,
  Users,
  FileText,
  MessageSquare,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { useNotification } from "../../context/NotificationContext";
import { apiClient } from "../../api/client";
import CreateTenantModal from "./CreateTenantModal";
import TenantDetailsModal from "./TenantDetailsModal";
import { X, UserPlus } from "lucide-react";

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  companyName: string;
  isActive: boolean;
  adminId: Array<{
    // Now it's an array of admins
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
    lastLogin?: string;
    role: string;
  }>;
  settings: {
    logo?: string;
    primaryColor?: string;
    companyEmail?: string;
    companyPhone?: string;
  };
  subscription: {
    plan: string;
    maxUsers: number;
    maxForms: number;
  };
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
  const [uploadingTenantId, setUploadingTenantId] = useState<string | null>(
    null
  );
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: { percentage: number; timeRemaining?: number };
  }>({});
  const { showSuccess, showError } = useNotification();

  // Add these state variables at the top of your component
  const [showAddAdminForm, setShowAddAdminForm] = useState<string | null>(null);
  const [newAdminData, setNewAdminData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [addingAdmin, setAddingAdmin] = useState<string | null>(null);

  const [editingAdmin, setEditingAdmin] = useState<{
    tenantId: string;
    admin: any;
  } | null>(null);
  const [editAdminData, setEditAdminData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [deletingAdmin, setDeletingAdmin] = useState<string | null>(null);
  const [updatingAdmin, setUpdatingAdmin] = useState<string | null>(null);

  const handleAddAdminClick = (tenantId: string) => {
    setShowAddAdminForm(tenantId);
    setNewAdminData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  const handleCancelAddAdmin = () => {
    setShowAddAdminForm(null);
    setNewAdminData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  const handleNewAdminChange = (field: string, value: string) => {
    setNewAdminData((prev) => ({
      ...prev,
      [field]: value,
    }));
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
      await apiClient.addAdminToTenant(tenantId, {
        firstName: newAdminData.firstName,
        lastName: newAdminData.lastName,
        email: newAdminData.email,
        password: newAdminData.password,
      });

      showSuccess("Admin added successfully");
      setShowAddAdminForm(null);
      setNewAdminData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      fetchTenants(); // Refresh the data
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
      const data = await apiClient.getTenants(searchTerm, statusFilter);
      setTenants(data.tenants);
    } catch (error: any) {
      showError(error.response?.message || "Failed to fetch tenants");
      console.error("Error fetching tenants:", error);
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
      console.error("Error toggling tenant status:", error);
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
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    // File size validation is now handled in the uploadFile method (10MB limit)
    setUploadingTenantId(tenantId);
    setUploadProgress({});

    try {
      const uploadResult = await apiClient.uploadFile(
        file,
        "tenant_logo",
        undefined,
        (progress) => {
          setUploadProgress((prev) => ({
            ...prev,
            [tenantId]: {
              percentage: progress.percentage,
              timeRemaining: progress.timeRemaining,
            },
          }));
        }
      );
      const logoUrl =
        apiClient.resolveUploadedFileUrl(uploadResult) + "?t=" + Date.now();
      const target = tenants.find((item) => item._id === tenantId);
      const settings = { ...(target?.settings || {}), logo: logoUrl };
      await apiClient.updateTenant(tenantId, { settings });
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant._id === tenantId ? { ...tenant, settings } : tenant
        )
      );
      showSuccess("Tenant logo updated successfully");
    } catch (error: any) {
      const message = error?.message || "Failed to upload tenant logo";
      showError(message, "Upload Failed");
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
        prev.map((tenant) =>
          tenant._id === tenantId ? { ...tenant, settings } : tenant
        )
      );
      showSuccess("Tenant logo removed");
    } catch (error: any) {
      const message = error?.message || "Failed to remove tenant logo";
      showError(message, "Remove Failed");
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
    });
  };

  const handleCancelEdit = () => {
    setEditingAdmin(null);
    setEditAdminData({
      firstName: "",
      lastName: "",
      email: "",
    });
  };

  const handleEditAdminChange = (field: string, value: string) => {
    setEditAdminData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

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

    setUpdatingAdmin(editingAdmin.admin._id);
    try {
      await apiClient.updateUser(editingAdmin.admin._id, {
        firstName: editAdminData.firstName,
        lastName: editAdminData.lastName,
        email: editAdminData.email,
      });

      showSuccess("Admin updated successfully");
      setEditingAdmin(null);
      setEditAdminData({
        firstName: "",
        lastName: "",
        email: "",
      });
      fetchTenants(); // Refresh the data
    } catch (error: any) {
      showError(error.response?.message || "Failed to update admin");
    } finally {
      setUpdatingAdmin(null);
    }
  };

  const handleDeleteAdmin = async (
    tenantId: string,
    adminId: string,
    adminName: string
  ) => {
    if (
      !window.confirm(
        `Are you sure you want to remove ${adminName}? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingAdmin(adminId);
    try {
      await apiClient.removeAdminFromTenant(tenantId, adminId);
      showSuccess("Admin removed successfully");
      fetchTenants(); // Refresh the data
    } catch (error: any) {
      showError(error.response?.message || "Failed to remove admin");
    } finally {
      setDeletingAdmin(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-6 border border-primary-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary-900 tracking-tight">
                Tenant Management
              </h1>
              <p className="text-primary-600 mt-1 text-lg">
                Manage all company branches and their admins
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setModalMode("create");
              setEditingTenant(null);
              setShowTenantModal(true);
            }}
            className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3 min-w-fit"
          >
            <Plus className="w-5 h-5" />
            <span>Create Tenant</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-neutral-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
            <Search className="w-4 h-4 text-primary-600" />
          </div>
          <h3 className="text-lg font-semibold text-primary-900">
            Search & Filter
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary-400" />
            <input
              type="text"
              placeholder="Search by name, slug, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-neutral-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-sm font-medium placeholder:text-neutral-400"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 border-2 border-neutral-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-sm font-medium bg-white dark:bg-gray-900 appearance-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg
                className="w-5 h-5 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tenants List */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-neutral-200 dark:border-gray-700 p-12 text-center shadow-sm">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-200 border-t-primary-600"></div>
          </div>
          <h3 className="text-lg font-semibold text-primary-900 mb-2">
            Loading tenants...
          </h3>
          <p className="text-primary-600">
            Please wait while we fetch your tenant data
          </p>
        </div>
      ) : tenants.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-neutral-200 dark:border-gray-700 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary-600" />
          </div>
          <h3 className="text-xl font-bold text-primary-900 mb-2">
            No tenants found
          </h3>
          <p className="text-primary-600 mb-6 text-lg">
            Get started by creating your first tenant to begin managing company
            branches
          </p>
          <button
            onClick={() => {
              setModalMode("create");
              setEditingTenant(null);
              setShowTenantModal(true);
            }}
            className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3 mx-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Create Your First Tenant</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tenants.map((tenant) => {
            const tenantLogo = tenant.settings?.logo;

            return (
              <div
                key={tenant._id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-neutral-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-primary-200 transition-all duration-200 group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl border border-primary-100 bg-primary-50 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow overflow-hidden">
                      {tenantLogo ? (
                        <img
                          src={tenantLogo}
                          alt={`${tenant.name} logo`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Building2 className="w-7 h-7 text-primary-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-primary-900 mb-1 truncate">
                        {tenant.name}
                      </h3>
                      <p className="text-sm text-primary-600 font-medium mb-1">
                        {tenant.companyName}
                      </p>
                      <p className="text-xs text-primary-500 font-mono bg-primary-50 px-2 py-1 rounded-md inline-block">
                        /{tenant.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                        tenant.isActive
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      {tenant.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="bg-neutral-50 rounded-xl p-4 mb-6 border border-neutral-200 dark:border-gray-700">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-16 h-16 rounded-lg border border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                      {tenantLogo ? (
                        <img
                          src={tenantLogo}
                          alt={`${tenant.name} logo preview`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-neutral-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-sm font-medium text-primary-900">
                        Tenant Logo
                      </p>
                      <p className="text-xs text-primary-600 mt-1">
                        Upload a custom logo to brand this tenant's workspace.
                        PNG, JPG, or GIF up to 10MB.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {uploadingTenantId === tenant._id &&
                        uploadProgress[tenant._id] ? (
                          <div className="w-full space-y-2">
                            <div className="flex items-center gap-2">
                              <Upload className="w-4 h-4 text-primary-600 animate-pulse" />
                              <span className="text-xs font-semibold text-primary-700">
                                Uploading...{" "}
                                {uploadProgress[tenant._id].percentage}%
                              </span>
                            </div>
                            <div className="w-full bg-neutral-200 rounded-full h-1.5">
                              <div
                                className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                                style={{
                                  width: `${
                                    uploadProgress[tenant._id].percentage
                                  }%`,
                                }}
                              ></div>
                            </div>
                            {uploadProgress[tenant._id].timeRemaining && (
                              <p className="text-xs text-neutral-500">
                                {Math.floor(
                                  uploadProgress[tenant._id].timeRemaining / 60
                                )}
                                :
                                {(uploadProgress[tenant._id].timeRemaining % 60)
                                  .toString()
                                  .padStart(2, "0")}{" "}
                                remaining
                              </p>
                            )}
                          </div>
                        ) : (
                          <>
                            <label
                              className={`inline-flex items-center gap-2 rounded-lg border border-primary-200 px-4 py-2 text-xs font-semibold text-primary-700 cursor-pointer hover:bg-primary-50 transition ${
                                uploadingTenantId === tenant._id
                                  ? "opacity-60 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <Upload className="w-4 h-4" />
                              <span>Upload Logo</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) =>
                                  handleTenantLogoChange(tenant._id, event)
                                }
                                disabled={uploadingTenantId === tenant._id}
                              />
                            </label>
                            {tenantLogo && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleTenantLogoRemove(tenant._id)
                                }
                                disabled={uploadingTenantId === tenant._id}
                                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin Info */}
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-4 mb-6 border border-primary-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <h4 className="text-sm font-semibold text-primary-900">
                        Administrators ({tenant.adminId.length})
                      </h4>
                    </div>
                    <button
                      onClick={() => handleAddAdminClick(tenant._id)}
                      className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-all"
                      disabled={showAddAdminForm === tenant._id}
                    >
                      <Users className="w-3 h-3" />+ Add Admin
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Add Admin Form */}
                    {showAddAdminForm === tenant._id && (
                      <div className="bg-white rounded-lg p-4 border-2 border-primary-300 shadow-md">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-sm font-semibold text-primary-900">
                            Add New Administrator
                          </h5>
                          <button
                            onClick={handleCancelAddAdmin}
                            className="text-neutral-500 hover:text-neutral-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          <div>
                            <label className="block text-xs font-medium text-primary-700 mb-1">
                              First Name *
                            </label>
                            <input
                              type="text"
                              value={newAdminData.firstName}
                              onChange={(e) =>
                                handleNewAdminChange(
                                  "firstName",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="Enter first name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-primary-700 mb-1">
                              Last Name *
                            </label>
                            <input
                              type="text"
                              value={newAdminData.lastName}
                              onChange={(e) =>
                                handleNewAdminChange("lastName", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="Enter last name"
                            />
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="block text-xs font-medium text-primary-700 mb-1">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            value={newAdminData.email}
                            onChange={(e) =>
                              handleNewAdminChange("email", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                            placeholder="Enter email address"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          <div>
                            <label className="block text-xs font-medium text-primary-700 mb-1">
                              Password *
                            </label>
                            <input
                              type="password"
                              value={newAdminData.password}
                              onChange={(e) =>
                                handleNewAdminChange("password", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="Enter password"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-primary-700 mb-1">
                              Confirm Password *
                            </label>
                            <input
                              type="password"
                              value={newAdminData.confirmPassword}
                              onChange={(e) =>
                                handleNewAdminChange(
                                  "confirmPassword",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="Confirm password"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddAdminSubmit(tenant._id)}
                            disabled={addingAdmin === tenant._id}
                            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            {addingAdmin === tenant._id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                Adding...
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4" />
                                Add Administrator
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleCancelAddAdmin}
                            className="px-4 py-2 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-sm font-medium rounded-lg transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {tenant.adminId.length === 0 ? (
                      <p className="text-primary-600 text-sm text-center py-2">
                        No administrators assigned
                      </p>
                    ) : (
                      tenant.adminId.map((admin) => (
                        <div
                          key={admin._id}
                          className="bg-white rounded-lg p-3 border border-primary-200 shadow-sm"
                        >
                          {/* Edit Admin Form */}
                          {editingAdmin &&
                          editingAdmin.admin._id === admin._id ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h5 className="text-sm font-semibold text-primary-900">
                                  Edit Administrator
                                </h5>
                                <button
                                  onClick={handleCancelEdit}
                                  className="text-neutral-500 hover:text-neutral-700 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-primary-700 mb-1">
                                    First Name *
                                  </label>
                                  <input
                                    type="text"
                                    value={editAdminData.firstName}
                                    onChange={(e) =>
                                      handleEditAdminChange(
                                        "firstName",
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    placeholder="Enter first name"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-primary-700 mb-1">
                                    Last Name *
                                  </label>
                                  <input
                                    type="text"
                                    value={editAdminData.lastName}
                                    onChange={(e) =>
                                      handleEditAdminChange(
                                        "lastName",
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    placeholder="Enter last name"
                                  />
                                </div>
                              </div>

                              <div className="mb-3">
                                <label className="block text-xs font-medium text-primary-700 mb-1">
                                  Email Address *
                                </label>
                                <input
                                  type="email"
                                  value={editAdminData.email}
                                  onChange={(e) =>
                                    handleEditAdminChange(
                                      "email",
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                  placeholder="Enter email address"
                                />
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={handleEditAdminSubmit}
                                  disabled={updatingAdmin === admin._id}
                                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                  {updatingAdmin === admin._id ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                      Update Admin
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-4 py-2 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-sm font-medium rounded-lg transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Admin Display */
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-semibold text-primary-900">
                                    {admin.firstName} {admin.lastName}
                                  </p>
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      admin.role === "superadmin"
                                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                                        : "bg-blue-100 text-blue-700 border border-blue-200"
                                    }`}
                                  >
                                    {admin.role}
                                  </span>
                                </div>
                                <p className="text-sm text-primary-600 font-medium mb-1">
                                  {admin.email}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      admin.isActive
                                        ? "bg-green-500"
                                        : "bg-red-500"
                                    }`}
                                  ></div>
                                  <span className="text-xs text-primary-600">
                                    {admin.isActive ? "Active" : "Inactive"}
                                  </span>
                                  {admin.lastLogin && (
                                    <>
                                      <span className="text-xs text-primary-400">
                                        •
                                      </span>
                                      <span className="text-xs text-primary-600">
                                        Last login:{" "}
                                        {new Date(
                                          admin.lastLogin
                                        ).toLocaleDateString()}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  onClick={() =>
                                    handleEditAdminClick(tenant._id, admin)
                                  }
                                  className="p-1 text-primary-600 hover:text-primary-800 transition-colors"
                                  title="Edit Admin"
                                  disabled={!!editingAdmin}
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                                {tenant.adminId.length > 1 && (
                                  <button
                                    onClick={() =>
                                      handleDeleteAdmin(
                                        tenant._id,
                                        admin._id,
                                        `${admin.firstName} ${admin.lastName}`
                                      )
                                    }
                                    disabled={
                                      deletingAdmin === admin._id ||
                                      !!editingAdmin
                                    }
                                    className="p-1 text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                                    title="Remove Admin"
                                  >
                                    {deletingAdmin === admin._id ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent"></div>
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Subscription Info */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-green-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-primary-900">
                      Subscription Details
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-4 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl border border-neutral-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                        Plan
                      </p>
                      <p className="text-lg font-bold text-primary-900 capitalize">
                        {tenant.subscription.plan}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                        Max Users
                      </p>
                      <p className="text-lg font-bold text-blue-900">
                        {tenant.subscription.maxUsers}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">
                        Max Forms
                      </p>
                      <p className="text-lg font-bold text-green-900">
                        {tenant.subscription.maxForms}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleViewDetails(tenant)}
                    className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold px-4 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Details</span>
                  </button>
                  <button
                    onClick={() => handleToggleStatus(tenant._id)}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center ${
                      tenant.isActive
                        ? "bg-red-100 text-red-700 hover:bg-red-200 border border-red-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200 border border-green-200"
                    }`}
                    title={
                      tenant.isActive ? "Deactivate tenant" : "Activate tenant"
                    }
                  >
                    <Power className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
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
        />
      )}
    </div>
  );
}
