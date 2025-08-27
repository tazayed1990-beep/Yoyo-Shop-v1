import React, { useEffect, useState } from 'react';
import { useApp } from '../hooks/useApp';
import { Language, Settings as SettingsType } from '../types';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const Settings: React.FC = () => {
  const { language, setLanguage, settings } = useApp();
  const [formState, setFormState] = useState<SettingsType>({
    companyName: '',
    companyAddress: '',
    companyPhone: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormState(settings);
    }
  }, [settings]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };
  
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({...prev, [name]: value}));
  };
  
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        const settingsDoc = doc(db, 'settings', 'main');
        await setDoc(settingsDoc, formState);
        alert('Settings saved successfully!');
    } catch (error) {
        console.error("Error saving settings: ", error);
        alert('Failed to save settings.');
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold text-gray-800 mb-6">Settings</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Application Settings">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700">Language</h4>
              <p className="text-sm text-gray-500">Choose the display language of the application.</p>
              <div className="mt-2 space-x-2">
                <Button 
                  onClick={() => handleLanguageChange('en')} 
                  variant={language === 'en' ? 'primary' : 'secondary'}
                  className={language !== 'en' ? 'opacity-50' : ''}
                >
                  English
                </Button>
                <Button 
                  onClick={() => handleLanguageChange('ar')} 
                  variant={language === 'ar' ? 'primary' : 'secondary'}
                  className={language !== 'ar' ? 'opacity-50' : ''}
                >
                  العربية
                </Button>
              </div>
            </div>
          </div>
        </Card>
        
        <Card title="Invoice Details">
           <form onSubmit={handleSaveSettings}>
            <div className="space-y-4">
                <Input label="Company Name" name="companyName" value={formState.companyName} onChange={handleFormChange} />
                <Input label="Company Address" name="companyAddress" value={formState.companyAddress} onChange={handleFormChange} />
                <Input label="Company Phone" name="companyPhone" value={formState.companyPhone} onChange={handleFormChange} />
            </div>
            <div className="mt-6">
                <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Invoice Details'}</Button>
            </div>
           </form>
        </Card>
      </div>
    </div>
  );
};

export default Settings;