import React, { useState, useEffect } from "react";
import { Plus, Trash2, Search, UserCircle } from "lucide-react";
import generate from "generate-password";
import type { StaffMember } from "../../../types";
import { staffApi } from "../../../api/storage";
import { sendWelcomeEmail } from "../../../utils/emailUtils";
import AddStaffModal from "./AddStaffModal";
import { useNotification } from "../../../context/NotificationContext";

interface StaffManagementProps {
  onClose: () => void;
}

export default function StaffManagement({ onClose }: StaffManagementProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "viewer" as StaffMember["role"],
    mobile: "",
    profilePic: "",
  });
  const { showSuccess, showError, showConfirm } = useNotification();

  useEffect(() => {
    const staffMembers = staffApi.getAll();
    setStaff(staffMembers);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          profilePic: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const userId = `USER${Math.floor(1000 + Math.random() * 9000)}`;
    const password = generate.generate({
      length: 12,
      numbers: true,
      symbols: true,
      uppercase: true,
      lowercase: true,
    });

    const newStaff: StaffMember = {
      id: crypto.randomUUID(),
      userId,
      password,
      ...formData,
    };

    const emailSent = await sendWelcomeEmail(newStaff);
    if (emailSent) {
      staffApi.save(newStaff);
      setStaff([...staff, newStaff]);
      setShowAddForm(false);
      setFormData({
        name: "",
        email: "",
        role: "viewer",
        mobile: "",
        profilePic: "",
      });
      showSuccess(
        "Staff member added and welcome email sent successfully",
        "Success"
      );
    } else {
      showError(
        "Failed to send welcome email. Please try again.",
        "Email Error"
      );
    }
  };

  const handleRemoveStaff = (id: string) => {
    showConfirm(
      "Are you sure you want to remove this staff member?",
      () => {
        staffApi.delete(id);
        setStaff(staff.filter((member) => member.id !== id));
        showSuccess("Staff member removed successfully", "Success");
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
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Staff Member
        </button>
      </div>

      {/* Staff List */}
      <div className="grid gap-4">
        {filteredStaff.map((member) => (
          <div
            key={member.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm space-y-4 sm:space-y-0"
          >
            <div className="flex items-center space-x-4 w-full sm:w-auto">
              {member.profilePic ? (
                <img
                  src={member.profilePic}
                  alt={member.name}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserCircle className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h5 className="font-medium text-gray-900 dark:text-white truncate">
                  {member.name}
                </h5>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {member.email}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {member.mobile}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ID: {member.userId}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4 w-full sm:w-auto justify-start sm:justify-end">
              <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {member.role}
              </span>
              <button
                onClick={() => handleRemoveStaff(member.id)}
                className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}

        {filteredStaff.length === 0 && (
          <div className="text-center py-8 bg-white dark:bg-gray-700 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">
              No staff members found
            </p>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddForm && (
        <AddStaffModal
          formData={formData}
          onSubmit={handleSubmit}
          onClose={() => setShowAddForm(false)}
          onImageUpload={handleImageUpload}
          onChange={handleFieldChange}
        />
      )}
    </div>
  );
}
