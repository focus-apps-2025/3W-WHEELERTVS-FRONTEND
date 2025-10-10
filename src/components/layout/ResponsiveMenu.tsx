import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface ResponsiveMenuProps {
  children: React.ReactNode;
}

export default function ResponsiveMenu({ children }: ResponsiveMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <div className={`
        fixed lg:static inset-0 z-50 bg-white dark:bg-gray-800
        transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:transform-none lg:translate-x-0
        transition-transform duration-200 ease-in-out
        w-64 lg:w-auto h-full lg:h-auto
        overflow-y-auto lg:overflow-visible
        ${isOpen ? 'block' : 'hidden lg:block'}
      `}>
        <div className="lg:hidden p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Menu</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}