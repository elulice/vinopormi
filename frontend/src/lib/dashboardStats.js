import { API } from './config';
import { apiGet } from './api';
import { subscribeData } from './dataEvents';

/**
 * /dashboard/stats lo piden el Layout (badge de deuda) y la pantalla Dashboard
 * al montar. Antes eran dos viajes de ~300 ms cada uno al abrir la app.
 * Acá compartimos el resultado reciente y el request en vuelo: si dos
 * componentes piden lo mismo al mismo tiempo, sale UNA sola llamada.
 */
const CACHE_TTL_MS = 30000;
const cache = new Map();
const inflight = new Map();
// Un request iniciado antes de un evento (ej. el toggle de "solo mis datos",
// donde la preferencia se guarda despues de cambiar el estado) no debe poder
// responder al refetch posterior: la clave incluye la generacion del cache.
let generation = 0;

const clave = (soloMisDatos) => `${soloMisDatos ? 'propios' : 'todos'}:${generation}`;

function invalidar() {
  generation += 1;
  cache.clear();
}

// Los eventos del bus (SSE, BroadcastChannel o header X-Data-*) siguen
// refrescando la pantalla: invalidamos antes de que corran los handlers de
// useDataRefresh porque este módulo se registra primero al importarse.
subscribeData(
  ['dashboard', 'ventas', 'clientes', 'movimientos', 'egresos'],
  invalidar
);

export function invalidateDashboardStats() {
  invalidar();
}

/**
 * Devuelve las stats del dashboard, reutilizando el cache y las peticiones
 * en curso. Errores NO se cachean para que el proximo intento vuelva a pedir.
 */
export function fetchDashboardStats({ soloMisDatos = false, force = false } = {}) {
  const key = clave(soloMisDatos);

  if (!force) {
    const entradas = cache.get(key);
    if (entradas && entradas.expires > Date.now()) {
      return Promise.resolve(entradas.data);
    }
  }

  if (inflight.has(key)) return inflight.get(key);

  // Siempre enviamos el parametro: el backend lo usa por encima de la
  // preferencia guardada para que el toggle no espere al PUT.
  const params = `?soloMisDatos=${soloMisDatos ? 'true' : 'false'}`;
  const request = apiGet(`${API}/dashboard/stats${params}`)
    .then((response) => {
      const data = response.data;
      cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}
