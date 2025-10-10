import React from "react";
import { useNotification } from "../../context/NotificationContext";
import NotificationModal from "./NotificationModal";
import Toast from "./Toast";

const NotificationContainer: React.FC = () => {
  const { notifications, hideNotification } = useNotification();

  return (
    <>
      {notifications.map((notification) => {
        // Use Toast for success, error, warning, info notifications
        if (
          ["success", "error", "warning", "info"].includes(notification.type)
        ) {
          return (
            <Toast
              key={notification.id}
              id={notification.id}
              type={notification.type}
              title={notification.title}
              message={notification.message}
              onClose={() => hideNotification(notification.id)}
              duration={notification.duration}
            />
          );
        }

        // Use Modal for confirm notifications
        return (
          <NotificationModal
            key={notification.id}
            id={notification.id}
            type={notification.type}
            title={notification.title}
            message={notification.message}
            onClose={() => hideNotification(notification.id)}
            onConfirm={notification.onConfirm}
            onCancel={notification.onCancel}
            confirmText={notification.confirmText}
            cancelText={notification.cancelText}
          />
        );
      })}
    </>
  );
};

export default NotificationContainer;
