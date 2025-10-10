import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  UserCircle,
  Mail,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react";
import type { StaffMember } from "../../../types";
import { staffApi } from "../../../api/storage";
import StaffForm from "./staff/StaffForm";
import { useNotification } from "../../../context/NotificationContext";

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const { showSuccess, showError, showConfirm } = useNotification();

  useEffect(() => {
    const staffMembers = staffApi.getAll();
    setStaff(staffMembers);
  }, []);

  const handleAddStaff = (newStaff: Omit<StaffMember, "id">) => {
    try {
      const staffMember: StaffMember = {
        id: crypto.randomUUID(),
        ...newStaff,
      };
      staffApi.save(staffMember);
      setStaff([...staff, staffMember]);
      setShowAddForm(false);
      showSuccess("Staff member added successfully", "Success");
    } catch (error: any) {
      showError(error.message || "Failed to add staff member", "Error");
    }
  };

  const handleEditStaff = (member: StaffMember) => {
    setSelectedStaff(member);
  };

  const handleUpdateStaff = (updatedStaff: Omit<StaffMember, "id">) => {
    try {
      const updated = { ...updatedStaff, id: selectedStaff!.id };
      staffApi.save(updated);
      setStaff(staff.map((s) => (s.id === updated.id ? updated : s)));
      setSelectedStaff(null);
      showSuccess("Staff member updated successfully", "Success");
    } catch (error: any) {
      showError(error.message || "Failed to update staff member", "Error");
    }
  };

  const handleRemoveStaff = (id: string) => {
    showConfirm(
      "Are you sure you want to remove this staff member?",
      () => {
        try {
          staffApi.delete(id);
          setStaff(staff.filter((member) => member.id !== id));
          showSuccess("Staff member removed successfully", "Success");
        } catch (error: any) {
          showError(error.message || "Failed to remove staff member", "Error");
        }
      },
      "Remove Staff Member",
      "Remove",
      "Cancel"
    );
  };

  const filteredStaff = staff.filter(
    (member) =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900">Staff Management</h3>
        <p className="text-sm text-gray-500 mt-1">
          Manage staff members and their information
        </p>
      </div>

      {/* Search and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search staff members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Staff Member
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaff.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {member.profilePic ? (
                        <img
                          src={member.profilePic}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <UserCircle className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {member.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {member.userId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{member.email}</div>
                    <div className="text-sm text-gray-500">{member.mobile}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEditStaff(member)}
                        className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleRemoveStaff(member.id)}
                        className="inline-flex items-center px-3 py-1.5 text-sm text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStaff.length === 0 && (
            <div className="text-center py-12">
              <UserCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">
                {searchTerm
                  ? "No staff members found matching your search"
                  : "No staff members added yet"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Staff Modal */}
      {(showAddForm || selectedStaff) && (
        <StaffForm
          initialData={selectedStaff}
          onSubmit={selectedStaff ? handleUpdateStaff : handleAddStaff}
          onCancel={() => {
            setShowAddForm(false);
            setSelectedStaff(null);
          }}
        />
      )}
    </div>
  );
}
