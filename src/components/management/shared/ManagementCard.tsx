import React from "react";

interface ManagementCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export default function ManagementCard({
  title,
  description,
  children,
  className = "",
}: ManagementCardProps) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}
    >
      {(title || description) && (
        <div className="px-6 py-4 border-b border-gray-200">
          {title && (
            <h4 className="text-md font-medium text-gray-900">{title}</h4>
          )}
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}
