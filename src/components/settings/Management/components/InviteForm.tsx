import React, { useState } from 'react';
import { Mail, Plus } from 'lucide-react';

interface InviteFormProps {
  onSubmit: (email: string) => void;
}

export default function InviteForm({ onSubmit }: InviteFormProps) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email);
    setEmail('');
  };

  return (
    <form id="invite-form" onSubmit={handleSubmit} className="mt-6 p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Add New Member</h4>
      <div className="flex space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Member
        </button>
      </div>
    </form>
  );
}