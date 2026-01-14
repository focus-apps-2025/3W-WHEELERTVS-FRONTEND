import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { NotificationType } from "../../context/NotificationContext";

interface ToastProps {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  onClose,
  duration = 4000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Show toast with animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss if duration is set
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Wait for animation
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "confirm":
        return <Info className="w-5 h-5 text-blue-500" />;
      case "info":
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case "success":
        return {
          bg: "bg-green-50",
          border: "border-green-200",
          text: "text-green-900",
        };
      case "error":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-900",
        };
      case "warning":
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-200",
          text: "text-yellow-900",
        };
      case "confirm":
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-900",
        };
      case "info":
      default:
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-900",
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] max-w-sm w-full transform transition-all duration-300 ${
        isVisible && !isExiting
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0"
      }`}
    >
      <div
        className={`${colors.bg} ${colors.border} border rounded-lg shadow-lg p-4 relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">{getIcon()}</div>
          <div className="flex-1 min-w-0">
            {title && (
              <h4 className={`text-sm font-semibold ${colors.text} mb-1`}>
                {title}
              </h4>
            )}
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Progress bar for auto-dismiss */}
        {duration > 0 && (
          <div className="mt-3 bg-gray-200 rounded-full h-1">
            <div
              className={`h-1 rounded-full transition-all ease-linear ${
                type === "success"
                  ? "bg-green-500"
                  : type === "error"
                  ? "bg-red-500"
                  : type === "warning"
                  ? "bg-yellow-500"
                  : "bg-blue-500"
              }`}
              style={{
                width: "100%",
                animation: `shrink ${duration}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
};

export default Toast;
