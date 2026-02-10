import { createContext, useContext, useState, useEffect } from 'react';

const ConfigContext = createContext(undefined);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

export const ConfigProvider = ({ children }) => {
  // Cargar configuración desde localStorage o usar valor por defecto
  const [showCents, setShowCentsState] = useState(() => {
    const saved = localStorage.getItem('vinopormi_show_cents');
    return saved !== null ? JSON.parse(saved) : true; // Por defecto mostrar centavos
  });

  const setShowCents = (show: boolean) => {
    setShowCentsState(show);
    localStorage.setItem('vinopormi_show_cents', JSON.stringify(show));
  };

  const toggleShowCents = () => {
    setShowCents(!showCents);
  };

  return (
    <ConfigContext.Provider value={{
      showCents,
      setShowCents,
      toggleShowCents
    }}>
      {children}
    </ConfigContext.Provider>
  );
};