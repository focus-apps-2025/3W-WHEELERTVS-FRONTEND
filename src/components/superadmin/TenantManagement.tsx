import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Power,
  Eye,
  Users,
  FileText,
  MessageSquare,
} from "lucide-react";
import { useNotification } from "../../context/NotificationContext";
import { apiClient } from "../../api/client";
import CreateTenantModal from "./CreateTenantModal";
import TenantDetailsModal from "./TenantDetailsModal";

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  companyName: string;
  isActive: boolean;
  adminId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
    lastLogin?: string;
  };
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
  const { showSuccess, showError } = useNotification();

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
    setShowCreateModal(false);
    fetchTenants();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">
            Tenant Management
          </h1>
          <p className="text-primary-600 mt-1">
            Manage all company branches and their admins
          </p>
        </div>
        <button
          onClick={() => {
            setModalMode("create");
            setEditingTenant(null);
            setShowTenantModal(true);
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Create Tenant</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary-400" />
            <input
              type="text"
              placeholder="Search by name, slug, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Tenants List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : tenants.length === 0 ? (
        <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-primary-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary-900 mb-2">
            No tenants found
          </h3>
          <p className="text-primary-600 mb-4">
            Get started by creating your first tenant
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Tenant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tenants.map((tenant) => (
            <div
              key={tenant._id}
              className="bg-white rounded-lg border border-neutral-200 p-6 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary-900">
                      {tenant.name}
                    </h3>
                    <p className="text-sm text-primary-600">
                      {tenant.companyName}
                    </p>
                    <p className="text-xs text-primary-500 mt-1">
                      /{tenant.slug}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    tenant.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {tenant.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Admin Info */}
              <div className="bg-primary-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-primary-600 mb-1">Admin</p>
                <p className="text-sm font-medium text-primary-900">
                  {tenant.adminId.firstName} {tenant.adminId.lastName}
                </p>
                <p className="text-xs text-primary-600">
                  {tenant.adminId.email}
                </p>
                {tenant.adminId.lastLogin && (
                  <p className="text-xs text-primary-500 mt-1">
                    Last login:{" "}
                    {new Date(tenant.adminId.lastLogin).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Subscription Info */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 bg-neutral-50 rounded">
                  <p className="text-xs text-primary-600">Plan</p>
                  <p className="text-sm font-medium text-primary-900 capitalize">
                    {tenant.subscription.plan}
                  </p>
                </div>
                <div className="text-center p-2 bg-neutral-50 rounded">
                  <p className="text-xs text-primary-600">Max Users</p>
                  <p className="text-sm font-medium text-primary-900">
                    {tenant.subscription.maxUsers}
                  </p>
                </div>
                <div className="text-center p-2 bg-neutral-50 rounded">
                  <p className="text-xs text-primary-600">Max Forms</p>
                  <p className="text-sm font-medium text-primary-900">
                    {tenant.subscription.maxForms}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleViewDetails(tenant)}
                  className="flex-1 btn-secondary text-sm py-2"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View Details
                </button>
                <button
                  onClick={() => handleToggleStatus(tenant._id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tenant.isActive
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateTenantModal
          onClose={() => setShowCreateModal(false)}
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
