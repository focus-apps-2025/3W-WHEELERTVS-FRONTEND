import React, { useState, useEffect } from "react";
import {
  X,
  Users,
  FileText,
  MessageSquare,
  TrendingUp,
  Key,
} from "lucide-react";
import { apiClient } from "../../api/client";
import ChangeTenantPasswordModal from "./ChangeTenantPasswordModal";

interface TenantDetailsModalProps {
  tenant: any;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TenantDetailsModal({
  tenant,
  onClose,
  onUpdate,
}: TenantDetailsModalProps) {
  const [stats, setStats] = useState({
    users: 0,
    forms: 0,
    responses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    fetchTenantStats();
  }, [tenant._id]);

  const fetchTenantStats = async () => {
    try {
      const data = await apiClient.getTenantStats(tenant._id);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching tenant stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-primary-900">
              {tenant.name}
            </h2>
            <p className="text-sm text-primary-600">{tenant.companyName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-primary-400 hover:text-primary-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-900">
                {loading ? "..." : stats.users}
              </p>
              <p className="text-sm text-blue-600">Users</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <FileText className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-900">
                {loading ? "..." : stats.forms}
              </p>
              <p className="text-sm text-green-600">Forms</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <MessageSquare className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-900">
                {loading ? "..." : stats.responses}
              </p>
              <p className="text-sm text-purple-600">Responses</p>
            </div>
          </div>

          {/* Tenant Info */}
          <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-primary-900">Tenant Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-primary-600">Slug</p>
                <p className="font-medium text-primary-900">/{tenant.slug}</p>
              </div>
              <div>
                <p className="text-primary-600">Status</p>
                <p
                  className={`font-medium ${
                    tenant.isActive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {tenant.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <div>
                <p className="text-primary-600">Created</p>
                <p className="font-medium text-primary-900">
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-primary-600">Last Updated</p>
                <p className="font-medium text-primary-900">
                  {new Date(tenant.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Admin Info */}
          <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-primary-900">
                Admin Information
              </h3>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="btn-secondary flex items-center text-xs"
              >
                <Key className="w-3 h-3 mr-1" />
                Change Password
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-primary-600">Name</span>
                <span className="font-medium text-primary-900">
                  {tenant.adminId.firstName} {tenant.adminId.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-600">Email</span>
                <span className="font-medium text-primary-900">
                  {tenant.adminId.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-600">Status</span>
                <span
                  className={`font-medium ${
                    tenant.adminId.isActive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {tenant.adminId.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {tenant.adminId.lastLogin && (
                <div className="flex justify-between">
                  <span className="text-primary-600">Last Login</span>
                  <span className="font-medium text-primary-900">
                    {new Date(tenant.adminId.lastLogin).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Subscription Info */}
          <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-primary-900">Subscription</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-primary-600">Plan</p>
                <p className="font-medium text-primary-900 capitalize">
                  {tenant.subscription.plan}
                </p>
              </div>
              <div>
                <p className="text-primary-600">Max Users</p>
                <p className="font-medium text-primary-900">
                  {stats.users} / {tenant.subscription.maxUsers}
                </p>
              </div>
              <div>
                <p className="text-primary-600">Max Forms</p>
                <p className="font-medium text-primary-900">
                  {stats.forms} / {tenant.subscription.maxForms}
                </p>
              </div>
            </div>
          </div>

          {/* Admin Login Info */}
          <div className="bg-primary-50 rounded-lg p-4">
            <h3 className="font-medium text-primary-900 mb-2">
              Admin Login Instructions
            </h3>
            <p className="text-sm text-primary-700 mb-3">
              Admin can login using their email and password. No tenant code
              required.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white dark:bg-gray-900 px-3 py-2 rounded border border-primary-200">
                <span className="text-sm text-primary-600">Email:</span>
                <code className="text-sm font-medium text-primary-900">
                  {tenant.adminId.email}
                </code>
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-gray-900 px-3 py-2 rounded border border-primary-200">
                <span className="text-sm text-primary-600">Tenant:</span>
                <code className="text-sm font-medium text-primary-900">
                  {tenant.name} ({tenant.slug})
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 dark:border-gray-700 px-6 py-4 flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangeTenantPasswordModal
          tenant={tenant}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
            setShowPasswordModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
