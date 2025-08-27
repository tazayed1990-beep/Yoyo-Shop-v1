import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Language, Settings } from '../types';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  settings: Settings | null;
  translations: Record<string, any>;
}

const defaultSettings: Settings = {
    companyName: 'Yoyo Shop',
    companyAddress: '123 Main St, Anytown, USA',
    companyPhone: '555-1234'
};

const EN_TRANSLATIONS = {
    dashboard: 'Dashboard',
    customers: 'Customers',
    orders: 'Orders',
    products: 'Products',
    materials: 'Materials',
    expenses: 'Expenses',
    reports: 'Reports',
    users: 'Users',
    settings: 'Settings',
    logout: 'Logout',
    addUser: 'Add User',
    uid: 'User ID (from Firebase Auth)',
    email: 'Email',
    name: 'Name',
    role: 'Role',
    addExpense: 'Add Expense',
    editExpense: 'Edit Expense',
    expenseName: 'Expense Name',
    category: 'Category',
    amount: 'Amount',
    date: 'Date',
    // Add more translations...
};

const AR_TRANSLATIONS = {
    dashboard: 'لوحة التحكم',
    customers: 'العملاء',
    orders: 'الطلبات',
    products: 'المنتجات',
    materials: 'الخامات',
    expenses: 'المصروفات',
    reports: 'التقارير',
    users: 'المستخدمون',
    settings: 'الإعدادات',
    logout: 'تسجيل الخروج',
    addUser: 'إضافة مستخدم',
    uid: 'معرف المستخدم (من Firebase Auth)',
    email: 'البريد الإلكتروني',
    name: 'الاسم',
    role: 'الدور',
    addExpense: 'إضافة مصروف',
    editExpense: 'تعديل مصروف',
    expenseName: 'اسم المصروف',
    category: 'الفئة',
    amount: 'المبلغ',
    date: 'التاريخ',
     // Add more translations...
};

export const AppContext = createContext<AppContextType>({
  language: 'en',
  setLanguage: () => {},
  settings: defaultSettings,
  translations: EN_TRANSLATIONS,
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>((localStorage.getItem('language') as Language) || 'en');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [translations, setTranslations] = useState(EN_TRANSLATIONS);

  useEffect(() => {
    // Listen for settings changes from Firestore
    const unsub = onSnapshot(doc(db, 'settings', 'main'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as Settings);
      } else {
        setSettings(defaultSettings);
      }
    });
    return () => unsub();
  }, []);
  
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    setTranslations(language === 'ar' ? AR_TRANSLATIONS : EN_TRANSLATIONS);
  }, [language]);

  const setLanguage = (lang: Language) => {
    localStorage.setItem('language', lang);
    setLanguageState(lang);
  };

  return (
    <AppContext.Provider value={{ language, setLanguage, settings, translations }}>
      {children}
    </AppContext.Provider>
  );
};