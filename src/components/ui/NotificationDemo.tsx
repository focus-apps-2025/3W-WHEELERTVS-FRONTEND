import React from "react";
import { useNotification } from "../../context/NotificationContext";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  HelpCircle,
} from "lucide-react";

/**
 * NotificationDemo Component
 *
 * This component demonstrates how to use the notification system throughout the application.
 * The notification system replaces all window.alert() and window.confirm() calls with
 * beautiful modal notifications.
 */
export default function NotificationDemo() {
  const { showSuccess, showError, showWarning, showInfo, showConfirm } =
    useNotification();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Notification System Demo
        </h1>
        <p className="text-gray-600">
          Click the buttons below to see different types of notifications in
          action.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Success Notification */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="w-6 h-6 text-green-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Success</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Use for successful operations like saving, creating, or updating
            data.
          </p>
          <button
            onClick={() =>
              showSuccess(
                "Your changes have been saved successfully!",
                "Success"
              )
            }
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Show Success
          </button>
          <div className="mt-3 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700">
            showSuccess("Message", "Title")
          </div>
        </div>

        {/* Error Notification */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <XCircle className="w-6 h-6 text-red-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Error</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Use for errors, failures, or when something goes wrong.
          </p>
          <button
            onClick={() =>
              showError("Failed to save changes. Please try again.", "Error")
            }
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Show Error
          </button>
          <div className="mt-3 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700">
            showError("Message", "Title")
          </div>
        </div>

        {/* Warning Notification */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Warning</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Use for warnings or important information that needs attention.
          </p>
          <button
            onClick={() =>
              showWarning("This action may affect other users.", "Warning")
            }
            className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Show Warning
          </button>
          <div className="mt-3 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700">
            showWarning("Message", "Title")
          </div>
        </div>

        {/* Info Notification */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Info className="w-6 h-6 text-blue-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Info</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Use for informational messages or helpful tips.
          </p>
          <button
            onClick={() =>
              showInfo("Your session will expire in 5 minutes.", "Information")
            }
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Show Info
          </button>
          <div className="mt-3 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700">
            showInfo("Message", "Title")
          </div>
        </div>

        {/* Confirm Dialog */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 md:col-span-2">
          <div className="flex items-center mb-4">
            <HelpCircle className="w-6 h-6 text-blue-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">
              Confirmation
            </h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Use for actions that require user confirmation, like deleting data.
            Replaces window.confirm() with a beautiful modal.
          </p>
          <button
            onClick={() =>
              showConfirm(
                "Are you sure you want to delete this item? This action cannot be undone.",
                () => {
                  showSuccess("Item deleted successfully!", "Deleted");
                },
                "Delete Item",
                "Delete",
                "Cancel"
              )
            }
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Show Confirmation
          </button>
          <div className="mt-3 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700">
            showConfirm(message, onConfirm, title, confirmText, cancelText)
          </div>
        </div>
      </div>

      {/* Usage Guide */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          How to Use in Your Components
        </h3>
        <div className="space-y-3 text-sm text-blue-800">
          <div>
            <p className="font-semibold mb-1">1. Import the hook:</p>
            <code className="block bg-white p-2 rounded text-xs">
              import {"{ useNotification }"} from
              "../context/NotificationContext";
            </code>
          </div>
          <div>
            <p className="font-semibold mb-1">2. Use in your component:</p>
            <code className="block bg-white p-2 rounded text-xs">
              const {"{ showSuccess, showError, showConfirm }"} =
              useNotification();
            </code>
          </div>
          <div>
            <p className="font-semibold mb-1">3. Call the methods:</p>
            <code className="block bg-white p-2 rounded text-xs">
              showSuccess("Operation completed!", "Success");
              <br />
              showError("Something went wrong", "Error");
              <br />
              showConfirm("Delete this?", () =&gt; handleDelete(), "Confirm");
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
