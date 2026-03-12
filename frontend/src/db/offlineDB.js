import Dexie from 'dexie';

export const db = new Dexie('VinoPorMi_OfflineDB');

db.version(2).stores({
  ventas_pendientes: '++id, fecha_creacion, sincronizado',
  egresos_pendientes: '++id, fecha_creacion, sincronizado',
  cache_productos: 'id, nombre, precio_unitario, stock, tipo',
  cache_clientes: 'id, nombre, dni'
});

export async function guardarVentaOffline(ventaData) {
  return await db.ventas_pendientes.add({
    ...ventaData,
    fecha_creacion: Date.now(),
    sincronizado: 0
  });
}

export async function obtenerVentasPendientes() {
  return await db.ventas_pendientes.where('sincronizado').equals(0).toArray();
}

export async function marcarVentaComoSincronizada(id) {
  return await db.ventas_pendientes.update(id, { sincronizado: 1 });
}

export async function guardarEgresoOffline(egresoData) {
  return await db.egresos_pendientes.add({
    ...egresoData,
    fecha_creacion: Date.now(),
    sincronizado: 0
  });
}

export async function obtenerEgresosPendientes() {
  return await db.egresos_pendientes.where('sincronizado').equals(0).toArray();
}

export async function marcarEgresoComoSincronizado(id) {
  return await db.egresos_pendientes.update(id, { sincronizado: 1 });
}

export async function actualizarCacheProductos(productos) {
  return await db.transaction('rw', db.cache_productos, async () => {
    await db.cache_productos.clear();
    return await db.cache_productos.bulkAdd(productos);
  });
}

export async function obtenerTodosProductos() {
  return await db.cache_productos.orderBy('nombre').toArray();
}

export async function obtenerProductoPorId(id) {
  return await db.cache_productos.get(id);
}

export async function buscarProductosLocal(query) {
  if (!query) return await obtenerTodosProductos();
  return await db.cache_productos
    .where('nombre')
    .startsWithIgnoreCase(query)
    .toArray();
}

export async function actualizarCacheClientes(clientes) {
  return await db.transaction('rw', db.cache_clientes, async () => {
    await db.cache_clientes.clear();
    return await db.cache_clientes.bulkAdd(clientes);
  });
}

export async function obtenerTodosClientes() {
  return await db.cache_clientes.orderBy('nombre').toArray();
}

export async function obtenerClientePorId(id) {
  return await db.cache_clientes.get(id);
}

export async function contarPendientes() {
  const v = await db.ventas_pendientes.where('sincronizado').equals(0).count();
  const e = await db.egresos_pendientes.where('sincronizado').equals(0).count();
  return v + e;
}
