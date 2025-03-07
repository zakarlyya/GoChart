import React from 'react';

interface HeaderProps {
  onLogout: () => void;
}

/**
 * Header component for the dashboard
 */
export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">GoChart</h1>
        <button
          onClick={onLogout}
          className="px-3 py-1 text-sm font-medium text-gray-300 hover:text-white"
        >
          Logout
        </button>
      </div>
    </header>
  );
}; 