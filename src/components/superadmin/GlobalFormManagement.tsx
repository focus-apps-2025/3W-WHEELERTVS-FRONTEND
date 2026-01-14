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
  ChevronRight,
  BarChart3,
  Clock,
  Users,
  TrendingUp
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

interface GlobalFormStat {
  tenantId: string;
  tenantName: string;
  companyName: string;
  responseCount: number;
  lastResponse: string;
}

export default function GlobalFormManagement() {
  const [forms, setForms] = useState<Form[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [formStats, setFormStats] = useState<GlobalFormStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
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

  const handleViewStats = async (form: Form) => {
    console.log("Viewing stats for form:", form);
    setSelectedForm(form);
    setShowStatsModal(true);
    setLoadingStats(true);
    try {
      const response = await apiClient.getGlobalFormStats(form._id);
      console.log("Stats response:", response);
      setFormStats(response.stats || []);
    } catch (error: any) {
      console.error("Error fetching form stats:", error);
      showError(error.response?.message || error.message || "Failed to fetch form statistics");
      setShowStatsModal(false);
    } finally {
      setLoadingStats(false);
    }
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
                    onClick={() => handleViewStats(form)}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg text-sm font-semibold transition-colors"
                  >
                    <BarChart3 className="w-4 h-4" />
                    View Stats
                  </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col border border-white/20">
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-br from-primary-50/50 to-transparent dark:from-primary-900/10">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <Building2 className="w-5 h-5 text-primary-600" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    Tenant Access
                  </h2>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  Assign <span className="text-primary-600 font-bold">"{selectedForm?.title}"</span> to specific tenants
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-200 hover:rotate-90"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tenants.map((tenant) => (
                  <button
                    key={tenant._id}
                    onClick={() => handleToggleTenant(tenant._id)}
                    className={`group relative flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 ${
                      selectedTenants.includes(tenant._id)
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg shadow-primary-500/10"
                        : "border-gray-100 dark:border-gray-800 hover:border-primary-200 dark:hover:border-primary-800 bg-white dark:bg-gray-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        selectedTenants.includes(tenant._id)
                          ? "bg-primary-600 text-white scale-110 shadow-lg"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-400 group-hover:scale-105"
                      }`}>
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className={`font-black tracking-tight ${
                          selectedTenants.includes(tenant._id) ? "text-primary-900 dark:text-primary-100" : "text-gray-700 dark:text-gray-300"
                        }`}>
                          {tenant.companyName}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{tenant.name}</p>
                      </div>
                    </div>
                    {selectedTenants.includes(tenant._id) && (
                      <div className="bg-primary-500 rounded-full p-1 shadow-lg">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-ping" />
                <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                  {selectedTenants.length} <span className="text-gray-400">Tenants Selected</span>
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-6 py-3 text-sm font-black text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignment}
                  className="group relative px-10 py-4 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-[0_10px_20px_rgba(37,99,235,0.3)] hover:shadow-primary-500/40 transition-all duration-300 active:scale-95 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Deploy Changes
                  </span>
                  <div className="absolute inset-0 bg-primary-700 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col border border-white/20">
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-br from-primary-50/50 to-transparent dark:from-primary-900/10">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-primary-600" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    Form Insights
                  </h2>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  Global analytics for <span className="text-primary-600 font-bold">"{selectedForm?.title}"</span>
                </p>
              </div>
              <button
                onClick={() => setShowStatsModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-200 hover:rotate-90"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {loadingStats ? (
                <div className="flex flex-col items-center justify-center p-20">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary-100 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 w-16 h-16 border-4 border-t-primary-600 rounded-full animate-spin"></div>
                  </div>
                  <p className="mt-6 text-gray-400 font-bold animate-pulse">Analyzing data...</p>
                </div>
              ) : formStats.length > 0 ? (
                <div className="space-y-8">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Total</span>
                      </div>
                      <p className="text-2xl font-black text-blue-900 dark:text-blue-100">
                        {formStats.reduce((acc, curr) => acc + curr.responseCount, 0)}
                      </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl border border-purple-100 dark:border-purple-800/50">
                      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Tenants</span>
                      </div>
                      <p className="text-2xl font-black text-purple-900 dark:text-purple-100">
                        {formStats.length}
                      </p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Recent</span>
                      </div>
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-100 leading-tight">
                        {new Date(Math.max(...formStats.map(s => new Date(s.lastResponse).getTime()))).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Tenant List */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">
                      Tenant Breakdown
                    </h3>
                    {formStats.map((stat, idx) => {
                      const totalResponses = formStats.reduce((acc, curr) => acc + curr.responseCount, 0);
                      const percentage = (stat.responseCount / totalResponses) * 100;
                      
                      return (
                        <div
                          key={stat.tenantId}
                          className="group relative flex flex-col p-5 bg-white dark:bg-gray-800/40 rounded-[1.5rem] border border-gray-100 dark:border-gray-700/50 hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl flex items-center justify-center shadow-inner border border-white dark:border-gray-600 group-hover:scale-110 transition-transform duration-300">
                                <Building2 className="w-6 h-6 text-primary-600" />
                              </div>
                              <div>
                                <p className="font-black text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">
                                  {stat.companyName}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-500 rounded-md">
                                    {stat.tenantName}
                                  </span>
                                  <span className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                                    <Clock className="w-3 h-3" />
                                    {new Date(stat.lastResponse).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-black bg-gradient-to-br from-primary-600 to-primary-800 bg-clip-text text-transparent">
                                {stat.responseCount}
                              </p>
                              <p className="text-[10px] uppercase tracking-wider font-black text-gray-400">
                                Submissions
                              </p>
                            </div>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-gray-50/50 dark:bg-gray-800/30 rounded-[2rem] border-4 border-dashed border-gray-100 dark:border-gray-800">
                  <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl border border-gray-50 dark:border-gray-700">
                    <BarChart3 className="w-10 h-10 text-gray-200" />
                  </div>
                  <h4 className="text-xl font-black text-gray-900 dark:text-white mb-2">No data yet!</h4>
                  <p className="text-gray-400 font-medium max-w-xs mx-auto">
                    Once tenants start submitting responses, your insights will bloom here.
                  </p>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end">
              <button
                onClick={() => setShowStatsModal(false)}
                className="group relative px-10 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl text-sm font-black shadow-2xl hover:shadow-primary-500/20 transition-all duration-300 active:scale-95 overflow-hidden"
              >
                <span className="relative z-10">Got it!</span>
                <div className="absolute inset-0 bg-primary-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
