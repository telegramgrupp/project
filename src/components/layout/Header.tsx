import React from 'react';
import { Video } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-2">
          <Video className="h-6 w-6 text-primary-500" />
          <span className="text-xl font-semibold text-gray-900 dark:text-white">VideoConnect</span>
        </div>
        <nav className="flex items-center space-x-4">
          {/* Navigation links will go here in the future */}
        </nav>
      </div>
    </header>
  );
};