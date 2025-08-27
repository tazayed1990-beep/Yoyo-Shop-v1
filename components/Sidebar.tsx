import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../utils/localization';
import { UserRole } from '../types';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };
  
  const navLinkClasses = ({ isActive }: { isActive: boolean }): string => 
    `flex items-center px-4 py-2.5 text-gray-300 transition-colors duration-200 transform rounded-lg hover:bg-gray-700 ${isActive ? 'bg-gray-700' : ''}`;
  
  const sidebarClasses = `
    fixed inset-y-0 left-0 z-30 flex flex-col w-64 h-screen px-4 py-8 bg-dark text-white overflow-y-auto 
    transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  `;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 z-20 bg-black opacity-50 md:hidden" onClick={() => setIsOpen(false)}></div>}

      <div className={sidebarClasses}>
        <div className="flex justify-between items-center">
            <h2 className="text-3xl font-semibold text-center text-primary">Yoyo Shop</h2>
            <button className="md:hidden text-gray-300" onClick={() => setIsOpen(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        
        <div className="flex flex-col justify-between flex-1 mt-6">
          <nav onClick={() => setIsOpen(false)}>
              <NavLink to="/dashboard" className={navLinkClasses}>
                  <span className="mx-4 font-medium">{t('dashboard')}</span>
              </NavLink>
              {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.STAFF) && (
                <>
                  <NavLink to="/orders" className={navLinkClasses}>
                      <span className="mx-4 font-medium">{t('orders')}</span>
                  </NavLink>
                  <NavLink to="/customers" className={navLinkClasses}>
                      <span className="mx-4 font-medium">{t('customers')}</span>
                  </NavLink>
                  <NavLink to="/products" className={navLinkClasses}>
                      <span className="mx-4 font-medium">{t('products')}</span>
                  </NavLink>
                </>
              )}
              {currentUser?.role === UserRole.ADMIN && (
                <>
                  <NavLink to="/materials" className={navLinkClasses}>
                      <span className="mx-4 font-medium">{t('materials')}</span>
                  </NavLink>
                  <NavLink to="/expenses" className={navLinkClasses}>
                    <span className="mx-4 font-medium">{t('expenses')}</span>
                  </NavLink>
                  <NavLink to="/reports" className={navLinkClasses}>
                      <span className="mx-4 font-medium">{t('reports')}</span>
                  </NavLink>
                  <NavLink to="/users" className={navLinkClasses}>
                      <span className="mx-4 font-medium">{t('users')}</span>
                  </NavLink>
                  <NavLink to="/settings" className={navLinkClasses}>
                      <span className="mx-4 font-medium">{t('settings')}</span>
                  </NavLink>
                </>
              )}
          </nav>

          <div>
              <div className="px-4 py-2 mt-2 text-sm text-gray-400 truncate">
                  {currentUser?.email} ({currentUser?.role})
              </div>
              <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2.5 text-gray-300 transition-colors duration-200 transform rounded-lg hover:bg-gray-700"
              >
                  <span className="mx-4 font-medium">{t('logout')}</span>
              </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;