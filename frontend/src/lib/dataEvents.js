import { useEffect, useRef } from 'react';
import { API } from './config';

/**
 * Bus de datos de v4: un dominio cambia -> todas las secciones suscriptas se
 * enteran. Tres fuentes alimentan el mismo evento (se deduplican por id):
 *  1) header X-Data-* de la respuesta que hizo esta pestaña,
 *  2) BroadcastChannel (otras pestañas del mismo navegador),
 *  3) SSE /api/data-events (cambios hechos por otros usuarios).
 */
const CHANNEL_NAME = 'vpm-data-events';
const MAX_SEEN_IDS = 300;

const subscribers = new Set();
const seenIds = new Set();
let channel = null;
let eventSource = null;
let reconnectTimer = null;
let yaConecto = false;

function remember(id) {
  if (!id || seenIds.has(id)) return false;
  seenIds.add(id);
  if (seenIds.size > MAX_SEEN_IDS) {
    seenIds.delete(seenIds.values().next().value);
  }
  return true;
}

export function emitDataChange(event, { broadcast = true } = {}) {
  if (!event || !Array.isArray(event.domains) || event.domains.length === 0) return;

  const id = event.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (!remember(id)) return;

  subscribers.forEach((entry) => {
    if (event.domains.some((domain) => entry.domains.has(domain))) {
      entry.handler(event);
    }
  });

  if (broadcast && channel) {
    try { channel.postMessage(event); } catch (_) { /* ignore */ }
  }
}

export function subscribeData(domains, handler) {
  const entry = { domains: new Set(domains || []), handler };
  subscribers.add(entry);
  return () => subscribers.delete(entry);
}

/**
 * Fuerza un refetch de los dominios suscriptos después de reconectar el SSE.
 * EventSource se cierra cuando la pestaña pasa a segundo plano (típico en el
 * celular): sin esto, los cambios ocurridos mientras estaba oculta no se ven
 * hasta recargar. No se emite por BroadcastChannel ni por SSE: es solo local.
 */
export function resyncData() {
  if (subscribers.size === 0) return;
  const id = `resync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  subscribers.forEach((entry) => {
    entry.handler({ id, domains: [...entry.domains], stockPatch: {}, reason: 'resync' });
  });
}

/**
 * Suscribe una pantalla a los dominios que consume.
 * Si el evento trae stockPatch y se paso `onPatch`, aplica SOLO ese parche y
 * no dispara el refetch completo (caso Productos tras una venta).
 */
export function useDataRefresh(domains, refresh, { onPatch = null, withEvent = false } = {}) {
  const refreshRef = useRef(refresh);
  const patchRef = useRef(onPatch);
  refreshRef.current = refresh;
  patchRef.current = onPatch;
  const withEventRef = useRef(withEvent);
  withEventRef.current = withEvent;

  const key = (domains || []).join('|');

  useEffect(() => {
    return subscribeData(key ? key.split('|') : [], (event) => {
      const patch = event.stockPatch;
      if (patchRef.current && patch && Object.keys(patch).length > 0) {
        patchRef.current(patch);
        return;
      }
      if (!refreshRef.current) return;
      // `withEvent` es opt-in: la mayoria de los handlers no espera argumentos.
      if (withEventRef.current) refreshRef.current(event);
      else refreshRef.current();
    });
  }, [key]);
}

/** Parchea stock en una lista de productos ya cargada, sin ir a la DB. */
export function applyStockPatch(productos, stocks) {
  if (!stocks || !Array.isArray(productos)) return productos;

  const patched = productos.map((p) => {
    const nuevo = stocks[p.id];
    return nuevo !== undefined && p.stock !== nuevo ? { ...p, stock: nuevo } : p;
  });

  const porId = {};
  patched.forEach((p) => { porId[p.id] = p; });

  return patched.map((p) => {
    if (p.tipo !== 'promo' || !p.productos_incluidos?.length) return p;
    const disponibles = p.productos_incluidos
      .map((inc) => {
        const incluido = porId[inc.producto_id];
        if (!incluido || incluido.stock == null) return null;
        return Math.floor(incluido.stock / (inc.cantidad || 1));
      })
      .filter((valor) => valor !== null);
    const stock = disponibles.length ? Math.min(...disponibles) : 0;
    return p.stock === stock ? p : { ...p, stock };
  });
}

if (typeof BroadcastChannel !== 'undefined') {
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (message) => {
    emitDataChange(message.data, { broadcast: false });
  };
}

/** Conecta el canal SSE. Llamar una sola vez desde el Layout. */
export function connectDataEvents() {
  if (eventSource || typeof EventSource === 'undefined') return () => {};

  const close = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (eventSource) eventSource.close();
    eventSource = null;
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, 5000);
  };

  const open = () => {
    const token = localStorage.getItem('token');
    // El Layout se monta antes del login: reintentar hasta que haya token.
    if (!token) {
      scheduleReconnect();
      return;
    }
    if (document.visibilityState === 'hidden') return;

    eventSource = new EventSource(
      `${API}/data-events?token=${encodeURIComponent(token)}`
    );
    eventSource.onopen = () => {
      // El primer onopen es el mount normal (esa carga ya trae los datos).
      // Solo resincronizamos cuando venimos de una desconexion.
      if (yaConecto) resyncData();
      yaConecto = true;
    };
    eventSource.onmessage = (message) => {
      try {
        emitDataChange(JSON.parse(message.data), { broadcast: false });
      } catch (_) { /* ignore */ }
    };
    eventSource.onerror = () => {
      close();
      scheduleReconnect();
    };
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      if (!eventSource && !reconnectTimer) open();
    } else {
      close();
    }
  };

  open();
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    close();
  };
}
