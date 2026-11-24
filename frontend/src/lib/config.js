// En desarrollo, si abrimos el front desde otro dispositivo (celular/tablet en la
// misma WiFi), "localhost" apunta al propio dispositivo. Derivamos el backend
// desde el hostname con el que se cargó la página para que use la IP de la PC.
const configuredBackend = process.env.REACT_APP_BACKEND_URL;
const getBackendUrl = () => {
  if (process.env.NODE_ENV === 'production') return configuredBackend;
  if (typeof window === 'undefined') return configuredBackend;

  const hostname = window.location.hostname;
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return configuredBackend;
  }

  const url = new URL(configuredBackend || window.location.origin);
  url.hostname = hostname;
  return url.origin;
};

const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api`;

// Flags globales de features. Herramientas queda deshabilitado temporalmente.
const FEATURES = { herramientas: false };

export { BACKEND_URL, API, FEATURES };
