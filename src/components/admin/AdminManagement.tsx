import React, {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { apiClient, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

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

const createInitialFormState = (): CreateFormState => ({
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  password: "",
  permissions: new Set<ModuleKey>(),
});

export default function AdminManagement() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<SubAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateFormState>(() => createInitialFormState());

  const isAdmin = user?.role === "admin";

  const loadSubAdmins = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.getUsers({ role: "subadmin", limit: 100 });
      setAdmins(Array.isArray(data.users) ? data.users : []);
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

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h1 className="text-xl font-semibold text-neutral-900">Access restricted</h1>
          <p className="mt-2 text-neutral-600">
            You need administrator rights to manage tenant administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Admin Management</h1>
            <p className="mt-2 text-neutral-600">
              Create and manage sub-admins for your tenant and control their module access.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Create sub-admin</h2>
        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              name="firstName"
              value={form.firstName}
              onChange={handleInputChange}
              required
              placeholder="First name"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              name="lastName"
              value={form.lastName}
              onChange={handleInputChange}
              required
              placeholder="Last name"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleInputChange}
              required
              placeholder="Email address"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              name="username"
              value={form.username}
              onChange={handleInputChange}
              required
              placeholder="Username"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleInputChange}
              required
              placeholder="Temporary password"
              className="md:col-span-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-neutral-900">Module access</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {MODULE_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    checked={form.permissions.has(option.key)}
                    onChange={() => toggleFormPermission(option.key)}
                  />
                  <span className="text-sm font-medium text-neutral-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add sub-admin"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Existing sub-admins</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : admins.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">
            No sub-admins have been created yet. Add one using the form above.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {admins.map((admin) => {
              const permissionSet = new Set(admin.permissions || []);

              return (
                <div
                  key={admin._id}
                  data-testid={`subadmin-card-${admin._id}`}
                  className="rounded-lg border border-neutral-200 px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {admin.firstName} {admin.lastName}
                      </p>
                      <p className="text-sm text-neutral-600">{admin.email}</p>
                      <p className="text-xs text-neutral-500">Username: {admin.username}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        admin.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {admin.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {MODULE_OPTIONS.map((option) => (
                      <label
                        key={`${admin._id}-${option.key}`}
                        className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-neutral-700">
                          {option.label}
                        </span>
                        <input
                          data-testid={`permission-${admin._id}-${option.key}`}
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                          checked={permissionSet.has(option.key)}
                          onChange={() => handleTogglePermission(admin._id, option.key)}
                          disabled={updatingId === admin._id}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
