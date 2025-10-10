import React, { createContext, useContext, useState, useCallback } from "react";

export type NotificationType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "confirm";

export interface NotificationOptions {
  title?: string;
  message: string;
  type?: NotificationType;
  duration?: number;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface Notification extends NotificationOptions {
  id: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (options: NotificationOptions) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showConfirm: (
    message: string,
    onConfirm: () => void | Promise<void>,
    title?: string,
    confirmText?: string,
    cancelText?: string
  ) => void;
  hideNotification: (id: string) => void;
  notifications: Notification[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const hideNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback(
    (options: NotificationOptions) => {
      const id = Math.random().toString(36).substring(7);
      const notification: Notification = {
        id,
        type: options.type || "info",
        title: options.title,
        message: options.message,
        duration: options.duration,
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
      };

      setNotifications((prev) => [...prev, notification]);

      // Auto-hide for non-confirm notifications
      if (options.type !== "confirm" && options.duration !== 0) {
        setTimeout(() => {
          hideNotification(id);
        }, options.duration || 5000);
      }
    },
    [hideNotification]
  );

  const showSuccess = useCallback(
    (message: string, title?: string) => {
      showNotification({
        type: "success",
        title: title || "Success",
        message,
        duration: 4000,
      });
    },
    [showNotification]
  );

  const showError = useCallback(
    (message: string, title?: string) => {
      showNotification({
        type: "error",
        title: title || "Error",
        message,
        duration: 6000,
      });
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (message: string, title?: string) => {
      showNotification({
        type: "warning",
        title: title || "Warning",
        message,
        duration: 5000,
      });
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (message: string, title?: string) => {
      showNotification({
        type: "info",
        title: title || "Information",
        message,
        duration: 4000,
      });
    },
    [showNotification]
  );

  const showConfirm = useCallback(
    (
      message: string,
      onConfirm: () => void | Promise<void>,
      title?: string,
      confirmText?: string,
      cancelText?: string
    ) => {
      showNotification({
        type: "confirm",
        title: title || "Confirm Action",
        message,
        onConfirm,
        confirmText: confirmText || "Confirm",
        cancelText: cancelText || "Cancel",
        duration: 0, // Don't auto-hide confirm dialogs
      });
    },
    [showNotification]
  );

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showConfirm,
        hideNotification,
        notifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
