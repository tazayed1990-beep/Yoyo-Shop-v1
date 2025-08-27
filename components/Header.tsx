import React from 'react';

interface HeaderProps {
  setIsOpen: (isOpen: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setIsOpen }) => {
  return (
    <header className="md:hidden bg-white shadow-md p-4 flex justify-between items-center">
      <h1 className="text-xl font-bold text-primary">Yoyo Shop</h1>
      <button onClick={() => setIsOpen(true)} className="text-gray-600 focus:outline-none">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>
    </header>
  );
};

export default Header;
