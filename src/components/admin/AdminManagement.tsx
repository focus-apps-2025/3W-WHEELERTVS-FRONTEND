import * as React from "react";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Loader2,
  Image as ImageIcon,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Edit2,
  X,
  Check,
  Phone,
  CheckCircle,
} from "lucide-react";
import { apiClient, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useLogo } from "../../context/LogoContext";
import { useNotification } from "../../context/NotificationContext";
import ResponseDashboard from "./ResponseDashboard.tsx";

const MODULE_OPTIONS = [
  { key: "dashboard:view", label: "Dashboard" },
  { key: "analytics:view", label: "Service Analytics" },
  { key: "requests:view", label: "Customer Requests" },
  { key: "requests:manage", label: "Request Management" },
] as const;

type ModuleKey = (typeof MODULE_OPTIONS)[number]["key"];

interface SubAdmin {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdBy?: string; // Add this to track who created the admin
  createdByRole?: string;
}

interface CreateFormState {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  mobile: string;
  role: "subadmin" | "inspector";
  permissions: Set<ModuleKey>;
  accessType: "website" | "mobile" | "both";
}

interface EditFormState extends CreateFormState {
  adminId: string;
}

const createInitialFormState = (): CreateFormState => ({
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  password: "",
  mobile: "",
  role: "subadmin",
  permissions: new Set<ModuleKey>(),
  accessType: "both",
});

export default function AdminManagement() {
  const { user, tenant, updateTenant, loading: authLoading } = useAuth();
  const { logo, updateLogo } = useLogo();
  const { showSuccess, showError } = useNotification();
  const [admins, setAdmins] = useState<SubAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingProgress, setBrandingProgress] = useState<{
    percentage: number;
    loaded: number;
    total: number;
    timeRemaining?: number;
    speed?: number;
  } | null>(null);
  const [form, setForm] = useState<CreateFormState>(() =>
    createInitialFormState(),
  );
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [editingForm, setEditingForm] = useState<EditFormState | null>(null);
  const [viewPasswordStates, setViewPasswordStates] = useState<
    Record<string, boolean>
  >({});
  const [deleteConfirmAdminId, setDeleteConfirmAdminId] = useState<
    string | null
  >(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [selectedAdmins, setSelectedAdmins] = useState<Set<string>>(new Set());

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [activeTab, setActiveTab] = useState<"admins" | "responses">("admins");
  const [performanceScores, setPerformanceScores] = useState<Record<string, number>>({});
  const TabNavigation = () => (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="flex space-x-8" aria-label="Tabs">
        <button
          onClick={() => setActiveTab("admins")}
          className={`
          py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm
          ${
            activeTab === "admins"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }
        `}
        >
          Administrators
        </button>
        <button
          onClick={() => setActiveTab("responses")}
          className={`
          py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm
          ${
            activeTab === "responses"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }
        `}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Users Response Dashboard
        </button>
      </nav>
    </div>
  );

  // Fetch tenant information if missing (only for superadmin)
  useEffect(() => {
    const fetchTenantIfNeeded = async () => {
      if (
        user?.tenantId &&
        !tenant &&
        !authLoading &&
        user.role === "superadmin"
      ) {
        try {
          const tenantResponse = await apiClient.getTenant(user.tenantId);
          updateTenant(tenantResponse.tenant);
        } catch (err) {
          console.warn("Failed to fetch tenant information:", err);
        }
      }
    };

    fetchTenantIfNeeded();
  }, [user?.tenantId, user?.role, tenant, authLoading, updateTenant]);

  const loadSubAdmins = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [adminData, subadminData, inspectorData] = await Promise.all([
        apiClient
          .getUsers({ role: "admin", limit: 100 })
          .catch(() => ({ users: [] })),
        apiClient
          .getUsers({ role: "subadmin", limit: 100 })
          .catch(() => ({ users: [] })),
        apiClient
          .getUsers({ role: "inspector", limit: 100 })
          .catch(() => ({ users: [] })),
      ]);

      const allUsers = [
        ...(Array.isArray(adminData.users) ? adminData.users : []),
        ...(Array.isArray(subadminData.users) ? subadminData.users : []),
        ...(Array.isArray(inspectorData.users) ? inspectorData.users : []),
      ];

      // Ensure creator information is properly set
      const usersWithCreatorInfo = allUsers.map((user) => ({
        ...user,
        // If createdBy is not set in the API response, we need to determine it
        // This is a fallback - ideally the API should return this info
        createdBy:
          user.createdBy || (user.role === "admin" ? "system" : undefined),
        createdByRole:
          user.createdByRole || (user.role === "admin" ? "system" : undefined),
      }));

      setAdmins(usersWithCreatorInfo);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load administrators";
      setError(message);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadSubAdmins();
  }, [loadSubAdmins]);

  useEffect(() => {
    const loadScores = async () => {
      try {
        const response = await apiClient.getPerformanceScores();
        if (response && response.data) {
          setPerformanceScores(response.data);
        }
      } catch (error) {
        console.error('Failed to load performance scores:', error);
        // Fallback to localStorage if API fails
        try {
          const scores = JSON.parse(localStorage.getItem('performanceScores') || '{}');
          setPerformanceScores(scores);
        } catch (localError) {
          console.error('Failed to load from localStorage:', localError);
          setPerformanceScores({});
        }
      }
    };
    loadScores();
  }, []);

  const handleBrandingFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const tenantId = user?.tenantId || tenant?._id;
    if (!tenantId) {
      setError("Tenant information not available. Please refresh the page.");
      return;
    }

    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setBrandingSaving(true);
    setError(null);
    setBrandingProgress(null);

    try {
      const uploadResult = await apiClient.uploadFile(
        file,
        "logo",
        undefined,
        (progress) => {
          setBrandingProgress(progress);
        },
      );

      const logoUrl =
        apiClient.resolveUploadedFileUrl(uploadResult) + "?t=" + Date.now();
      const settings = { ...(tenant?.settings || {}), logo: logoUrl };

      await apiClient.updateTenant(tenantId, { settings });
      if (tenant) {
        updateTenant({ ...tenant, settings });
      }
      updateLogo(logoUrl);
      showSuccess("Tenant logo updated successfully", "Logo Updated");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to upload logo";
      setError(message);
      showError(message, "Error");
    } finally {
      setBrandingSaving(false);
      setBrandingProgress(null);
      input.value = "";
    }
  };

  const handleBrandingRemove = async () => {
    const tenantId = user?.tenantId || tenant?._id;
    if (!tenantId || brandingSaving) {
      return;
    }

    setBrandingSaving(true);
    setError(null);

    try {
      const settings = { ...(tenant?.settings || {}), logo: "" };
      await apiClient.updateTenant(tenantId, { settings });
      if (tenant) {
        updateTenant({ ...tenant, settings });
      }
      updateLogo("");
      showSuccess("Tenant logo removed", "Logo Removed");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to remove logo";
      setError(message);
      showError(message, "Error");
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleFormPermission = (permission: ModuleKey) => {
    setForm((prev) => {
      const nextPermissions = new Set(prev.permissions);
      if (nextPermissions.has(permission)) {
        nextPermissions.delete(permission);
      } else {
        nextPermissions.add(permission);
      }
      return { ...prev, permissions: nextPermissions };
    });
  };

  const handleSendOtp = async () => {
    if (!form.mobile) {
      showError("Please enter mobile number first");
      return;
    }
    setSendingOtp(true);
    try {
      const response = await apiClient.sendOtp(form.mobile);
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
      const response = await apiClient.verifyOtp(form.mobile, otp);
      setOtpVerified(true);
      showSuccess(response.message || "Mobile number verified successfully!");
    } catch (error: any) {
      showError(error.response?.message || "Invalid OTP");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
      return;
    }

    if (!otpVerified) {
      showError("Please verify the mobile number first");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        mobile: form.mobile.trim(),
        role: form.role,
        permissions: Array.from(form.permissions),
        accessType: form.role === "inspector" ? form.accessType : undefined,
        createdBy: user?._id, // Track who created this admin
        createdByRole: user?.role, // Also track the role of the creator
      };

      const result = await apiClient.createUser(payload);
      const created = result.user as SubAdmin | undefined;

      setForm(createInitialFormState());
      setOtp("");
      setOtpSent(false);
      setOtpVerified(false);
      setShowAddAdminModal(false);

      if (created) {
        // Add the creator info to the created admin object
        const newAdmin = {
          ...created,
          createdBy: user?._id,
          createdByRole: user?.role,
        };
        setAdmins((prev) => [...prev, newAdmin]);
        showSuccess("Administrator created successfully", "Success");
      } else {
        await loadSubAdmins();
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to create administrator";
      setError(message);
      showError(message, "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (
    adminId: string,
    permission: ModuleKey,
  ) => {
    if (!isAdmin) {
      return;
    }

    setUpdatingId(adminId);
    setError(null);

    try {
      const target = admins.find((item) => item._id === adminId);
      if (!target) {
        return;
      }

      const nextPermissions = new Set(target.permissions || []);
      if (nextPermissions.has(permission)) {
        nextPermissions.delete(permission);
      } else {
        nextPermissions.add(permission);
      }

      await apiClient.updateUser(adminId, {
        permissions: Array.from(nextPermissions),
      });

      setAdmins((prev) =>
        prev.map((item) =>
          item._id === adminId
            ? { ...item, permissions: Array.from(nextPermissions) }
            : item,
        ),
      );
      showSuccess("Permissions updated successfully", "Success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update permissions";
      setError(message);
      showError(message, "Error");
      await loadSubAdmins();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEditAdmin = (admin: SubAdmin) => {
    setEditingForm({
      adminId: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      username: admin.username,
      password: "",
      role: admin.role === "inspector" ? "inspector" : "subadmin",
      permissions: new Set(admin.permissions || []),
      accessType: (admin as any).accessType || "both",
    });
  };

  const handleCancelEdit = () => {
    setEditingForm(null);
    setViewPasswordStates({});
  };

  const handleEditInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setEditingForm((prev) => {
      if (!prev) return null;
      return { ...prev, [name]: value };
    });
  };

  const handleEditPermissionToggle = (permission: ModuleKey) => {
    setEditingForm((prev) => {
      if (!prev) return null;
      const nextPermissions = new Set(prev.permissions);
      if (nextPermissions.has(permission)) {
        nextPermissions.delete(permission);
      } else {
        nextPermissions.add(permission);
      }
      return { ...prev, permissions: nextPermissions };
    });
  };

  const handleSaveAdminChanges = async () => {
    if (!editingForm || !isAdmin) {
      return;
    }

    setUpdatingId(editingForm.adminId);
    setError(null);

    try {
      const updatePayload: {
        firstName: string;
        lastName: string;
        email: string;
        username: string;
        role: string;
        permissions: string[];
        password?: string;
      } = {
        firstName: editingForm.firstName.trim(),
        lastName: editingForm.lastName.trim(),
        email: editingForm.email.trim(),
        username: editingForm.username.trim(),
        role: editingForm.role,
        permissions: Array.from(editingForm.permissions),
        accessType:
          editingForm.role === "inspector" ? editingForm.accessType : undefined,
      };

      if (editingForm.password) {
        updatePayload.password = editingForm.password;
      }

      await apiClient.updateUser(editingForm.adminId, updatePayload);

      setAdmins((prev) =>
        prev.map((item) =>
          item._id === editingForm.adminId
            ? {
                ...item,
                firstName: editingForm.firstName,
                lastName: editingForm.lastName,
                email: editingForm.email,
                username: editingForm.username,
                role: editingForm.role,
                permissions: Array.from(editingForm.permissions),
              }
            : item,
        ),
      );

      handleCancelEdit();
      showSuccess("Admin updated successfully", "Success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update admin";
      setError(message);
      showError(message, "Error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActiveStatus = async (adminId: string) => {
    if (!isAdmin) {
      return;
    }

    setUpdatingId(adminId);
    setError(null);

    try {
      const target = admins.find((item) => item._id === adminId);
      if (!target) {
        return;
      }

      await apiClient.updateUser(adminId, {
        isActive: !target.isActive,
      });

      setAdmins((prev) =>
        prev.map((item) =>
          item._id === adminId ? { ...item, isActive: !item.isActive } : item,
        ),
      );

      showSuccess(
        `Admin ${!target.isActive ? "activated" : "deactivated"} successfully`,
        "Success",
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update admin status";
      setError(message);
      showError(message, "Error");
    } finally {
      setUpdatingId(null);
    }
  };

  // const handleDeleteAdmin = async (adminId: string) => {
  //   if (!isAdmin) {
  //     return;
  //   }

  //   setUpdatingId(adminId);
  //   setError(null);

  //   try {
  //     await apiClient.deleteUser(adminId);

  //     setAdmins((prev) => prev.filter((item) => item._id !== adminId));
  //     setDeleteConfirmAdminId(null);
  //     showSuccess("Admin deleted successfully", "Success");
  //   } catch (err) {
  //     const message = err instanceof ApiError ? err.message : "Failed to delete admin";
  //     setError(message);
  //     showError(message, "Error");
  //   } finally {
  //     setUpdatingId(null);
  //   }
  // };
  const handleDeactivateAdmin = async (adminId: string) => {
    if (!isAdmin) {
      return;
    }

    setUpdatingId(adminId);
    setError(null);

    try {
      const target = admins.find((item) => item._id === adminId);
      if (!target) {
        return;
      }

      // Instead of deleting, we deactivate the user
      await apiClient.updateUser(adminId, {
        isActive: false,
      });

      setAdmins((prev) =>
        prev.map((item) =>
          item._id === adminId ? { ...item, isActive: false } : item,
        ),
      );

      setDeleteConfirmAdminId(null);
      showSuccess(
        `Admin ${target.firstName} ${target.lastName} has been deactivated`,
        "Success",
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to deactivate admin";
      setError(message);
      showError(message, "Error");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleViewPassword = (adminId: string) => {
    setViewPasswordStates((prev) => ({
      ...prev,
      [adminId]: !prev[adminId],
    }));
  };

  const handleSelectAll = () => {
    if (selectedAdmins.size === admins.length) {
      setSelectedAdmins(new Set());
    } else {
      setSelectedAdmins(new Set(admins.map((admin) => admin._id)));
    }
  };

  const handleSelectAdmin = (adminId: string) => {
    const newSelected = new Set(selectedAdmins);
    if (newSelected.has(adminId)) {
      newSelected.delete(adminId);
    } else {
      newSelected.add(adminId);
    }
    setSelectedAdmins(newSelected);
  };

  if (!isAdmin) {
    return (
      <div className="w-full px-6 md:px-8 py-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Access restricted
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            You need administrator rights to manage tenant administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 md:px-8 py-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl">
        <div className="p-6 md:p-8 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                Admin Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage Users and their permissions
              </p>
            </div>
            {activeTab === "admins" && (
              <button
                onClick={() => setShowAddAdminModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 font-semibold transition-colors shadow-lg hover:shadow-xl"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Users
              </button>
            )}
          </div>
        </div>

        {/* Add the Tab Navigation here */}
        <TabNavigation />

        {authLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12">
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Loading...
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Fetching tenant information
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Show branding section only on admins tab for superadmin */}
            {activeTab === "admins" &&
              tenant &&
              user?.role === "superadmin" && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-8 mb-10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24 rounded-xl border-2 border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden shadow-sm">
                        <img
                          src={logo}
                          alt="Tenant logo"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        <ImageIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 absolute" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          Tenant Branding
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Customize your portal appearance
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {brandingSaving ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                            <Upload className="w-4 h-4 animate-pulse" />
                            <span className="font-medium">
                              {brandingProgress
                                ? `Uploading... ${brandingProgress.percentage}%`
                                : "Uploading..."}
                            </span>
                          </div>
                          {brandingProgress && (
                            <div className="w-48 bg-gray-300 dark:bg-gray-700 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                style={{
                                  width: `${brandingProgress.percentage}%`,
                                }}
                              ></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <label className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold cursor-pointer transition shadow-sm">
                            <Upload className="w-4 h-4" />
                            <span>Upload Logo</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleBrandingFileChange}
                            />
                          </label>
                          {logo && (
                            <button
                              type="button"
                              onClick={handleBrandingRemove}
                              disabled={brandingSaving}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-sm font-semibold transition disabled:opacity-60"
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
              )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-5 py-4 rounded-xl mb-8 flex items-start gap-3">
                <div className="flex-shrink-0 text-lg">⚠️</div>
                <div>{error}</div>
              </div>
            )}

            {/* Conditionally render based on active tab */}
            {activeTab === "admins" ? (
              /* ===== ADMINISTRATORS TAB CONTENT ===== */
              <>
                {/* Add Admin Modal */}
                {showAddAdminModal && (
                  <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-0.5 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-2xl w-full my-8">
                      <div className="sticky top-0 bg-primary-600 px-6 py-4 flex items-center justify-between ">
                        <h2 className="text-2xl font-bold text-white">
                          Add New Administrator
                        </h2>
                        <button
                          onClick={() => {
                            setShowAddAdminModal(false);
                            setForm(createInitialFormState());
                            setOtp("");
                            setOtpSent(false);
                            setOtpVerified(false);
                          }}
                          className="text-white/80 hover:text-white transition"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      <form className="space-y-6 p-8" onSubmit={handleCreate}>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                            Full Name
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              name="firstName"
                              value={form.firstName}
                              onChange={handleInputChange}
                              required
                              placeholder="First name"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            />
                            <input
                              name="lastName"
                              value={form.lastName}
                              onChange={handleInputChange}
                              required
                              placeholder="Last name"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                            Contact Information
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              name="email"
                              type="email"
                              value={form.email}
                              onChange={handleInputChange}
                              required
                              placeholder="Email address"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            />
                            <input
                              name="username"
                              value={form.username}
                              onChange={handleInputChange}
                              required
                              placeholder="Username"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            />
                          </div>

                          <div className="mt-4">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                              Mobile Number *
                            </label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  name="mobile"
                                  type="tel"
                                  value={form.mobile}
                                  onChange={handleInputChange}
                                  required
                                  disabled={otpSent && !otpVerified}
                                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-sm disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                                  placeholder="Enter mobile number"
                                />
                              </div>
                              {!otpVerified && (
                                <button
                                  type="button"
                                  onClick={handleSendOtp}
                                  disabled={sendingOtp || !form.mobile}
                                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 text-xs font-semibold disabled:opacity-50"
                                >
                                  {sendingOtp ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                                  ) : (
                                    "Send OTP"
                                  )}
                                </button>
                              )}
                              {otpVerified && (
                                <div className="flex items-center text-green-600 gap-1 bg-green-50 dark:bg-green-900/10 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800 shadow-sm">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-xs font-bold">
                                    Verified
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {otpSent && !otpVerified && (
                            <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800 rounded-xl space-y-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                              <label className="block text-xs font-semibold text-primary-900 dark:text-primary-100">
                                Enter 6-Digit OTP
                              </label>
                              <div className="flex gap-2 text-center">
                                <input
                                  type="text"
                                  maxLength={6}
                                  value={otp}
                                  onChange={(e) =>
                                    setOtp(e.target.value.replace(/\D/g, ""))
                                  }
                                  className="flex-1 px-4 py-3 border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-center text-lg font-bold tracking-[0.5em] shadow-inner"
                                  placeholder="000000"
                                />
                                <button
                                  type="button"
                                  onClick={handleVerifyOtp}
                                  disabled={verifyingOtp || otp.length !== 6}
                                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-xs"
                                >
                                  {verifyingOtp ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                  ) : (
                                    "Verify"
                                  )}
                                </button>
                              </div>
                              <p className="text-[10px] text-primary-600 dark:text-primary-400 text-center font-medium">
                                Didn't receive code?{" "}
                                <button
                                  type="button"
                                  onClick={handleSendOtp}
                                  className="underline font-bold hover:text-primary-800 dark:hover:text-primary-200"
                                >
                                  Resend OTP
                                </button>
                              </p>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                            Temporary Password
                          </label>
                          <div className="relative">
                            <input
                              name="password"
                              type={
                                viewPasswordStates["create"]
                                  ? "text"
                                  : "password"
                              }
                              value={form.password}
                              onChange={handleInputChange}
                              required
                              placeholder="Enter temporary password"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12"
                            />
                            <button
                              type="button"
                              onClick={() => toggleViewPassword("create")}
                              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
                            >
                              {viewPasswordStates["create"] ? (
                                <EyeOff className="w-5 h-5" />
                              ) : (
                                <Eye className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                            User Role
                          </label>
                          <select
                            name="role"
                            value={form.role}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                role: e.target.value as
                                  | "subadmin"
                                  | "inspector",
                              }))
                            }
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                          >
                            <option value="subadmin">Subadmin</option>
                            <option value="inspector">Inspector</option>
                          </select>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Inspector can view forms, fill forms, and access
                            analytics (all forms). Subadmin has full access with
                            permissions.
                          </p>
                        </div>

                        {form.role === "inspector" && (
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                              Access Via
                            </label>
                            <select
                              name="accessType"
                              value={form.accessType}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  accessType: e.target.value as
                                    | "website"
                                    | "mobile"
                                    | "both",
                                }))
                              }
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            >
                              <option value="both">
                                Both (Website + Mobile)
                              </option>
                              <option value="website">Website Only</option>
                              <option value="mobile">Mobile App Only</option>
                            </select>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Select how this inspector can access the system.
                            </p>
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                            Module Access
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {MODULE_OPTIONS.map((option) => (
                              <label
                                key={option.key}
                                className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition"
                              >
                                <input
                                  type="checkbox"
                                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-500 text-blue-600 dark:text-blue-500 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                  checked={form.permissions.has(option.key)}
                                  onChange={() =>
                                    toggleFormPermission(option.key)
                                  }
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                  {option.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                          <button
                            type="submit"
                            disabled={saving || !otpVerified}
                            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-8 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60 transition"
                          >
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              "Add User"
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Administrators Table */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                          Users
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {selectedAdmins.size > 0
                            ? `${selectedAdmins.size} selected`
                            : `${admins.length} total Users`}
                        </p>
                      </div>
                      {selectedAdmins.size > 0 && (
                        <button
                          onClick={() => {
                            setSelectedAdmins(new Set());
                          }}
                          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-16">
                      <div className="text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">
                          Loading Users...
                        </p>
                      </div>
                    </div>
                  ) : admins.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                        <svg
                          className="w-8 h-8 text-gray-400 dark:text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4.354a4 4 0 110 5.292M15 21H3.598a4 4 0 01-3.996-3.558M21.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                          />
                        </svg>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium">
                        No User yet
                      </p>
                      <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
                        Create your first User using the button above
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th className="px-6 py-4 text-left">
                              <input
                                type="checkbox"
                                checked={
                                  selectedAdmins.size === admins.length &&
                                  admins.length > 0
                                }
                                onChange={handleSelectAll}
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Admin
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Status
                            </th>
                             <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                               Role
                             </th>
                             <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                               Performance Score
                             </th>
                             <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                               Contact
                             </th>
                            {/* Permission Headers */}
                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                              Dashboard
                            </th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">
                              Service Analytics
                            </th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[130px]">
                              Customer Requests
                            </th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[130px]">
                              Request Management
                            </th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {admins.map((admin) => {
                            const permissionSet = new Set(
                              admin.permissions || [],
                            );
                            const isSuperAdminCreated =
                              admin.createdBy === user?._id &&
                              user?.role === "superadmin";

                            return (
                              <tr
                                key={admin._id}
                                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                                  deleteConfirmAdminId === admin._id
                                    ? "bg-red-50 dark:bg-red-900/20"
                                    : ""
                                }`}
                              >
                                <td className="px-6 py-4">
                                  <input
                                    type="checkbox"
                                    checked={selectedAdmins.has(admin._id)}
                                    onChange={() =>
                                      handleSelectAdmin(admin._id)
                                    }
                                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                                      {admin.firstName[0]}
                                      {admin.lastName[0]}
                                    </div>
                                    <div className="ml-3">
                                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {admin.firstName} {admin.lastName}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        @{admin.username}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <button
                                    onClick={() =>
                                      handleToggleActiveStatus(admin._id)
                                    }
                                    disabled={updatingId === admin._id}
                                    className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                      admin.isActive
                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                                        : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    }`}
                                  >
                                    {updatingId === admin._id ? (
                                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                    ) : null}
                                    {admin.isActive ? "Active" : "Inactive"}
                                  </button>
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                      admin.role === "admin"
                                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                                        : admin.role === "subadmin"
                                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                          : admin.role === "inspector"
                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                                    }`}
                                  >
                                    {admin.role === "subadmin"
                                      ? "Subadmin"
                                      : admin.role === "inspector"
                                        ? "Inspector"
                                        : admin.role}
                                   </span>
                                 </td>
                                 <td className="px-6 py-4">
                                   <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                     {(performanceScores[admin._id] || 0)}%
                                   </span>
                                 </td>
                                 <td className="px-6 py-4">
                                   <div className="text-sm text-gray-900 dark:text-gray-100">
                                     {admin.email}
                                   </div>
                                 </td>

                                {/* Permission Checkboxes */}
                                {MODULE_OPTIONS.map((option) => {
                                  // Determine if permissions should be editable
                                  const isSuperAdmin =
                                    user?.role === "superadmin";
                                  const isAdminUser = user?.role === "admin";
                                  const wasCreatedBySuperAdmin =
                                    admin.createdByRole === "superadmin" ||
                                    admin.role === "admin";

                                  // Show checkboxes for:
                                  // 1. Superadmins (can edit all)
                                  // 2. Admins editing admins NOT created by superadmins
                                  const showCheckbox =
                                    isSuperAdmin ||
                                    (isAdminUser && !wasCreatedBySuperAdmin);

                                  return (
                                    <td
                                      key={`${admin._id}-${option.key}`}
                                      className="px-6 py-4 text-center"
                                    >
                                      {showCheckbox ? (
                                        <input
                                          type="checkbox"
                                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                          checked={permissionSet.has(
                                            option.key,
                                          )}
                                          onChange={() =>
                                            handleTogglePermission(
                                              admin._id,
                                              option.key,
                                            )
                                          }
                                          disabled={updatingId === admin._id}
                                        />
                                      ) : (
                                        <span className="text-gray-400 dark:text-gray-600 text-xs">
                                          —
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}

                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleEditAdmin(admin)}
                                      disabled={updatingId === admin._id}
                                      className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                      title="Edit Admin"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setDeleteConfirmAdminId(admin._id)
                                      }
                                      disabled={updatingId === admin._id}
                                      className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                      title={
                                        admin.isActive
                                          ? "Deactivate Admin"
                                          : "Already Deactivated"
                                      }
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Edit Admin Modal */}
                {editingForm && (
                  <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-2xl w-full my-8">
                      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6 flex items-center justify-between rounded-t-2xl">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          Edit Administrator
                        </h2>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>

                      <form
                        className="space-y-6 p-8"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveAdminChanges();
                        }}
                      >
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                            Full Name
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              name="firstName"
                              value={editingForm.firstName}
                              onChange={handleEditInputChange}
                              required
                              placeholder="First name"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            />
                            <input
                              name="lastName"
                              value={editingForm.lastName}
                              onChange={handleEditInputChange}
                              required
                              placeholder="Last name"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                            Contact Information
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              name="email"
                              type="email"
                              value={editingForm.email}
                              onChange={handleEditInputChange}
                              required
                              placeholder="Email address"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            />
                            <input
                              name="username"
                              value={editingForm.username}
                              onChange={handleEditInputChange}
                              required
                              placeholder="Username"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                            Password
                          </label>
                          <div className="relative">
                            <input
                              name="password"
                              type={
                                viewPasswordStates[editingForm.adminId]
                                  ? "text"
                                  : "password"
                              }
                              value={editingForm.password}
                              onChange={handleEditInputChange}
                              placeholder="New password (leave blank to keep current)"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                toggleViewPassword(editingForm.adminId)
                              }
                              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
                            >
                              {viewPasswordStates[editingForm.adminId] ? (
                                <EyeOff className="w-5 h-5" />
                              ) : (
                                <Eye className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                            User Role
                          </label>
                          <select
                            name="role"
                            value={editingForm.role}
                            onChange={(e) =>
                              setEditingForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      role: e.target.value as
                                        | "subadmin"
                                        | "inspector",
                                    }
                                  : null,
                              )
                            }
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                          >
                            <option value="subadmin">Subadmin</option>
                            <option value="inspector">Inspector</option>
                          </select>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Inspector can view forms, fill forms, and access
                            analytics (all forms). Subadmin has full access with
                            permissions.
                          </p>
                        </div>

                        {editingForm.role === "inspector" && (
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                              Access Via
                            </label>
                            <select
                              name="accessType"
                              value={editingForm.accessType}
                              onChange={(e) =>
                                setEditingForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        accessType: e.target.value as
                                          | "website"
                                          | "mobile"
                                          | "both",
                                      }
                                    : null,
                                )
                              }
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            >
                              <option value="both">
                                Both (Website + Mobile)
                              </option>
                              <option value="website">Website Only</option>
                              <option value="mobile">Mobile App Only</option>
                            </select>
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                            Module Access
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {MODULE_OPTIONS.map((option) => (
                              <label
                                key={option.key}
                                className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition"
                              >
                                <input
                                  type="checkbox"
                                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-500 text-blue-600 dark:text-blue-500 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                  checked={editingForm.permissions.has(
                                    option.key,
                                  )}
                                  onChange={() =>
                                    handleEditPermissionToggle(option.key)
                                  }
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                  {option.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                          <button
                            type="submit"
                            disabled={updatingId === editingForm.adminId}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60 transition"
                          >
                            {updatingId === editingForm.adminId ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                Save Changes
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={updatingId === editingForm.adminId}
                            className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 px-6 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Delete/Deactivate Confirmation Modal */}
                {deleteConfirmAdminId && (
                  <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-md w-full p-6">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                          Deactivate Administrator?
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                          This will deactivate the administrator. They will no
                          longer be able to access the system. You can
                          reactivate them later from the status toggle.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() =>
                              handleDeactivateAdmin(deleteConfirmAdminId)
                            }
                            disabled={updatingId === deleteConfirmAdminId}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60 transition"
                          >
                            {updatingId === deleteConfirmAdminId ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Deactivating...
                              </>
                            ) : (
                              "Deactivate"
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmAdminId(null)}
                            disabled={updatingId === deleteConfirmAdminId}
                            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-60 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ===== USERS RESPONSE DASHBOARD TAB CONTENT ===== */
              <ResponseDashboard />
            )}
          </>
        )}
      </div>
    </div>
  );
}
