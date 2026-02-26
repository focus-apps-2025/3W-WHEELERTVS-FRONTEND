import React, {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Loader2, Image as ImageIcon, Upload, Trash2, Eye, EyeOff, Edit2, X, Check } from "lucide-react";
import { apiClient, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useLogo } from "../../context/LogoContext";
import { useNotification } from "../../context/NotificationContext";

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
  permissions: string[];
  isActive: boolean;
}

interface CreateFormState {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  permissions: Set<ModuleKey>;
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
  permissions: new Set<ModuleKey>(),
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
  const [form, setForm] = useState<CreateFormState>(() => createInitialFormState());
  const [editingForm, setEditingForm] = useState<EditFormState | null>(null);
  const [viewPasswordStates, setViewPasswordStates] = useState<Record<string, boolean>>({});
  const [deleteConfirmAdminId, setDeleteConfirmAdminId] = useState<string | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Fetch tenant information if missing (only for superadmin)
  useEffect(() => {
    const fetchTenantIfNeeded = async () => {
      if (user?.tenantId && !tenant && !authLoading && user.role === "superadmin") {
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
      const [adminData, subadminData] = await Promise.all([
        apiClient.getUsers({ role: "admin", limit: 100 }).catch(() => ({ users: [] })),
        apiClient.getUsers({ role: "subadmin", limit: 100 }).catch(() => ({ users: [] }))
      ]);
      
      const allUsers = [
        ...(Array.isArray(adminData.users) ? adminData.users : []),
        ...(Array.isArray(subadminData.users) ? subadminData.users : [])
      ];
      
      setAdmins(allUsers);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load administrators";
      setError(message);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadSubAdmins();
  }, [loadSubAdmins]);

  const handleBrandingFileChange = async (
    event: ChangeEvent<HTMLInputElement>
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

    // File size validation is now handled in the uploadFile method
    setBrandingSaving(true);
    setError(null);
    setBrandingProgress(null);

    try {
      const uploadResult = await apiClient.uploadFile(
        file,
        "logo",
        undefined, // No associatedId for tenant logo
        (progress) => {
          setBrandingProgress(progress);
        }
      );

      const logoUrl = apiClient.resolveUploadedFileUrl(uploadResult) + '?t=' + Date.now();
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

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
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
        role: "subadmin",
        permissions: Array.from(form.permissions),
      };

      const result = await apiClient.createUser(payload);
      const created = result.user as SubAdmin | undefined;

      setForm(createInitialFormState());

      if (created) {
        setAdmins((prev) => [...prev, created]);
      } else {
        await loadSubAdmins();
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create administrator";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (adminId: string, permission: ModuleKey) => {
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
            : item
        )
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update permissions";
      setError(message);
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
      permissions: new Set(admin.permissions || []),
    });
  };

  const handleCancelEdit = () => {
    setEditingForm(null);
    setViewPasswordStates({});
  };

  const handleEditInputChange = (event: ChangeEvent<HTMLInputElement>) => {
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
        permissions: string[];
        password?: string;
      } = {
        firstName: editingForm.firstName.trim(),
        lastName: editingForm.lastName.trim(),
        email: editingForm.email.trim(),
        username: editingForm.username.trim(),
        permissions: Array.from(editingForm.permissions),
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
                permissions: Array.from(editingForm.permissions),
              }
            : item
        )
      );

      handleCancelEdit();
      showSuccess("Admin updated successfully", "Success");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update admin";
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
          item._id === adminId
            ? { ...item, isActive: !item.isActive }
            : item
        )
      );

      showSuccess(
        `Admin ${!target.isActive ? "activated" : "deactivated"} successfully`,
        "Success"
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update admin status";
      setError(message);
      showError(message, "Error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!isAdmin) {
      return;
    }

    setUpdatingId(adminId);
    setError(null);

    try {
      await apiClient.deleteUser(adminId);

      setAdmins((prev) => prev.filter((item) => item._id !== adminId));
      setDeleteConfirmAdminId(null);
      showSuccess("Admin deleted successfully", "Success");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete admin";
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

  if (!isAdmin) {
    return (
      <div className="w-full px-6 md:px-8 py-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Access restricted</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            You need administrator rights to manage tenant administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 md:p-8">
      <div className="w-full">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Admin Management</h1>
          </div>
          <button
            onClick={() => setShowAddAdminModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 font-semibold transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Administrator
          </button>
        </div>

        {authLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12">
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Loading...</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Fetching tenant information</p>
            </div>
          </div>
        ) : tenant && user?.role === "superadmin" && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-8 mb-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 rounded-xl border-2 border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden shadow-sm">
                  <img 
                    src={logo} 
                    alt="Tenant logo" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <ImageIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 absolute" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Tenant Branding</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Customize your portal appearance</p>
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
                          : "Uploading..."
                        }
                      </span>
                    </div>
                    {brandingProgress && (
                      <div className="w-48 bg-gray-300 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${brandingProgress.percentage}%` }}
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

        {showAddAdminModal && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-2xl w-full my-8">
              <div className="sticky top-0 bg-primary-600 px-8 py-6 flex items-center justify-between rounded-t-2xl">
                <h2 className="text-2xl font-bold text-white">Add New Administrator</h2>
                <button
                  onClick={() => {
                    setShowAddAdminModal(false);
                    setForm(createInitialFormState());
                  }}
                  className="text-white/80 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form className="space-y-6 p-8" onSubmit={(e) => {
                handleCreate(e);
                setShowAddAdminModal(false);
              }}>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Full Name</label>
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
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Contact Information</label>
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
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Temporary Password</label>
                  <div className="relative">
                    <input
                      name="password"
                      type={viewPasswordStates["create"] ? "text" : "password"}
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
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Module Access</p>
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
                          onChange={() => toggleFormPermission(option.key)}
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-8 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60 transition"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Add Administrator"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 mb-10 shadow-lg">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Administrators</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{admins.length} total administrator{admins.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">Loading administrators...</p>
              </div>
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3.598a4 4 0 01-3.996-3.558M21.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                No administrators yet
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
                Create your first administrator using the form above
              </p>
            </div>
          ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {admins.map((admin) => {
                  const permissionSet = new Set(admin.permissions || []);

                  return (
                    <div key={admin._id} className="relative">
                      {deleteConfirmAdminId === admin._id ? (
                        <div className="h-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex flex-col justify-center animate-in fade-in zoom-in duration-200">
                          <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <p className="text-sm text-red-900 dark:text-red-100 font-bold mb-1">
                              Delete Administrator?
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-300">
                              {admin.firstName} {admin.lastName} will be permanently removed.
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleDeleteAdmin(admin._id)}
                              disabled={updatingId === admin._id}
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm"
                            >
                              {updatingId === admin._id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                "Confirm Delete"
                              )}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmAdminId(null)}
                              disabled={updatingId === admin._id}
                              className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-60 disabled:cursor-not-allowed transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          data-testid={`subadmin-card-${admin._id}`}
                          className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-blue-100 dark:border-gray-600 p-6 hover:shadow-lg transition-all duration-300 flex flex-col group"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-600 flex items-center justify-center text-lg font-bold text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-gray-500">
                              {admin.firstName[0]}{admin.lastName[0]}
                            </div>
                            <button
                              onClick={() => handleToggleActiveStatus(admin._id)}
                              disabled={updatingId === admin._id}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer disabled:opacity-60 shadow-sm ${
                                admin.isActive
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                                  : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
                              }`}
                            >
                              {updatingId === admin._id && !deleteConfirmAdminId ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                admin.isActive ? "Active" : "Inactive"
                              )}
                            </button>
                          </div>

                          <div className="mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate" title={`${admin.firstName} ${admin.lastName}`}>
                              {admin.firstName} {admin.lastName}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate" title={admin.email}>
                              {admin.email}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">@{admin.username}</p>
                          </div>

                          <div className="mt-auto pt-4 border-t border-blue-200 dark:border-gray-600">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                              Access Permissions
                            </p>
                            <div className="space-y-2.5 mb-6">
                              {MODULE_OPTIONS.map((option) => (
                                <label
                                  key={`${admin._id}-${option.key}`}
                                  className="flex items-center gap-2.5 cursor-pointer group/option"
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 ${
                                    permissionSet.has(option.key)
                                      ? "bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500 shadow-sm"
                                      : "border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-700 group-hover/option:border-blue-400"
                                  }`}>
                                    {permissionSet.has(option.key) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                  </div>
                                  <input
                                    data-testid={`permission-${admin._id}-${option.key}`}
                                    type="checkbox"
                                    className="hidden"
                                    checked={permissionSet.has(option.key)}
                                    onChange={() => handleTogglePermission(admin._id, option.key)}
                                    disabled={updatingId === admin._id}
                                  />
                                  <span className={`text-xs font-medium transition-colors ${
                                    permissionSet.has(option.key)
                                      ? "text-gray-900 dark:text-gray-200"
                                      : "text-gray-500 dark:text-gray-500 group-hover/option:text-gray-700 dark:group-hover/option:text-gray-300"
                                  }`}>
                                    {option.label}
                                  </span>
                                </label>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditAdmin(admin)}
                                disabled={updatingId === admin._id}
                                className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition shadow-sm disabled:opacity-60"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteConfirmAdminId(admin._id)}
                                disabled={updatingId === admin._id}
                                className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 transition shadow-sm disabled:opacity-60"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {editingForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Administrator</h2>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <X className="w-6 h-6 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                </button>
              </div>

              <form className="p-8 space-y-6" onSubmit={(e) => { e.preventDefault(); handleSaveAdminChanges(); }}>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Full Name</label>
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
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Contact Information</label>
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
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Password</label>
                  <div className="relative">
                    <input
                      name="password"
                      type={viewPasswordStates[editingForm.adminId] ? "text" : "password"}
                      value={editingForm.password}
                      onChange={handleEditInputChange}
                      placeholder="New password (leave blank to keep current)"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => toggleViewPassword(editingForm.adminId)}
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
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Module Access</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {MODULE_OPTIONS.map((option) => (
                      <label
                        key={option.key}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-gray-300 dark:border-gray-500 text-blue-600 dark:text-blue-500 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          checked={editingForm.permissions.has(option.key)}
                          onChange={() => handleEditPermissionToggle(option.key)}
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
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
      </div>
    </div>
  );
}
