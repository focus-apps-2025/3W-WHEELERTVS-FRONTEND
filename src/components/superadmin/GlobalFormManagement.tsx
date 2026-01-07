import React, { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Settings,
  Building2,
  CheckCircle2,
  X,
  Save,
  ChevronRight
} from "lucide-react";
import { useNotification } from "../../context/NotificationContext";
import { apiClient } from "../../api/client";
import { Link } from "react-router-dom";

interface Tenant {
  _id: string;
  name: string;
  companyName: string;
  isActive: boolean;
}

interface Form {
  _id: string;
  id: string;
  title: string;
  description: string;
  isGlobal: boolean;
  sharedWithTenants: string[];
  isActive: boolean;
  createdAt: string;
}

export default function GlobalFormManagement() {
  const [forms, setForms] = useState<Form[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [formsData, tenantsData] = await Promise.all([
        apiClient.getForms({ isGlobal: true }),
        apiClient.getTenants("", "active")
      ]);
      
      setForms(formsData.forms);
      setTenants(tenantsData.tenants);
    } catch (error: any) {
      showError(error.response?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssign = (form: Form) => {
    setSelectedForm(form);
    setSelectedTenants(form.sharedWithTenants || []);
    setShowAssignModal(true);
  };

  const handleToggleTenant = (tenantId: string) => {
    setSelectedTenants(prev => 
      prev.includes(tenantId) 
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const handleSaveAssignment = async () => {
    if (!selectedForm) return;

    try {
      await apiClient.updateForm(selectedForm._id, {
        isGlobal: true,
        sharedWithTenants: selectedTenants
      });
      showSuccess("Form assignments updated successfully");
      setShowAssignModal(false);
      fetchData();
    } catch (error: any) {
      showError(error.response?.message || "Failed to update assignments");
    }
  };

  const filteredForms = forms.filter(form => 
    form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    form.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-6 border border-primary-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary-900 tracking-tight">
                Global Form Management
              </h1>
              <p className="text-primary-600 mt-1 text-lg">
                Create forms and assign them to multiple tenants
              </p>
            </div>
          </div>
          <Link
            to="/forms/create?isGlobal=true"
            className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3 min-w-fit"
          >
            <Plus className="w-5 h-5" />
            <span>Create Global Form</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-neutral-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary-400" />
          <input
            type="text"
            placeholder="Search forms by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-neutral-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-sm font-medium placeholder:text-neutral-400"
          />
        </div>
      </div>

      {/* Forms List */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredForms.map((form) => (
            <div
              key={form._id}
              className="bg-white dark:bg-gray-900 rounded-xl border border-neutral-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {form.title}
                      </h3>
                      {form.isGlobal && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          Global
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 line-clamp-1">
                      {form.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        Assigned to {form.sharedWithTenants?.length || 0} tenants
                      </span>
                      <span className="text-xs text-gray-400">
                        Created: {new Date(form.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenAssign(form)}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg text-sm font-semibold transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Assign Tenants
                  </button>
                  <Link
                    to={`/forms/${form.id}/edit`}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Edit Form
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {filteredForms.length === 0 && (
            <div className="text-center p-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-gray-500">No forms found matching your search.</p>
            </div>
          )}
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Assign Form to Tenants
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Select which tenants should have access to "{selectedForm?.title}"
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tenants.map((tenant) => (
                  <button
                    key={tenant._id}
                    onClick={() => handleToggleTenant(tenant._id)}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedTenants.includes(tenant._id)
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                        : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        selectedTenants.includes(tenant._id)
                          ? "bg-primary-100 text-primary-600"
                          : "bg-gray-100 text-gray-400"
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className={`font-semibold ${
                          selectedTenants.includes(tenant._id) ? "text-primary-900 dark:text-primary-100" : "text-gray-700 dark:text-gray-300"
                        }`}>
                          {tenant.companyName}
                        </p>
                        <p className="text-xs text-gray-500">{tenant.name}</p>
                      </div>
                    </div>
                    {selectedTenants.includes(tenant._id) && (
                      <CheckCircle2 className="w-5 h-5 text-primary-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {selectedTenants.length} tenants selected
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignment}
                  className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold shadow-lg transition-all"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
