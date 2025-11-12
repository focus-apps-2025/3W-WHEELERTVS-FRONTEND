import React from "react";

interface ManagementHeaderProps {
  title: string;
  description: string;
}

export default function ManagementHeader({
  title,
  description,
}: ManagementHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h1>
      <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
    </div>
  );
}
