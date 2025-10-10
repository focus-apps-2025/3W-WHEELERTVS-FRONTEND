import React, { useState } from "react";
import { X } from "lucide-react";
import type { StaffMember } from "../../../../types";
import StaffForm from "./StaffForm";

interface StaffFormModalProps {
  onSubmit: (data: Omit<StaffMember, "id">) => void;
  onClose: () => void;
}

export default function StaffFormModal({
  onSubmit,
  onClose,
}: StaffFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-primary-900">
            Add New Staff Member
          </h3>
          <button
            onClick={onClose}
            className="text-primary-500 hover:text-primary-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <StaffForm onSubmit={onSubmit} onCancel={onClose} />
      </div>
    </div>
  );
}
