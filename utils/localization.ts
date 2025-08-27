
import { useApp } from '../hooks/useApp';

export const useTranslation = () => {
  const { translations } = useApp();

  const t = (key: string): string => {
    return translations[key] || key;
  };

  return { t };
};
