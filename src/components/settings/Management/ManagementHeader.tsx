import React from 'react';

interface ManagementHeaderProps {
  title: string;
  description: string;
}

export default function ManagementHeader({ title, description }: ManagementHeaderProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}