import Dexie from 'dexie';

export const db = new Dexie('VinoPorMi_OfflineDB');

db.version(1).stores({
  ventas_pendientes: '++id, fecha_creacion',
  egresos_pendientes: '++id, fecha_creacion',
  cache_productos: 'id, nombre, precio_unitario, stock, tipo',
  cache_clientes: 'id, nombre, dni'
});

export async function guardarVentaOffline(ventaData) {
  return await db.ventas_pendientes.add({
    ...ventaData,
    fecha_creacion: Date.now(),
    sincronizado: false
  });
}

export async function obtenerVentasPendientes() {
  const todas = await db.ventas_pendientes.toArray();
  return todas.filter(v => v.sincronizado === false);
}

export async function marcarVentaComoSincronizada(id) {
  return await db.ventas_pendientes.update(id, { sincronizado: true });
}

export async function actualizarCacheProductos(productos) {
  await db.cache_productos.clear();
  return await db.cache_productos.bulkAdd(productos);
}

export async function guardarEgresoOffline(egresoData) {
  return await db.egresos_pendientes.add({
    ...egresoData,
    fecha_creacion: Date.now(),
    sincronizado: false
  });
}

export async function obtenerEgresosPendientes() {
  const todas = await db.egresos_pendientes.toArray();
  return todas.filter(e => e.sincronizado === false);
}

export async function marcarEgresoComoSincronizado(id) {
  return await db.egresos_pendientes.update(id, { sincronizado: true });
}

export async function actualizarCacheClientes(clientes) {
  await db.cache_clientes.clear();
  return await db.cache_clientes.bulkAdd(clientes);
}

export async function obtenerProductoPorId(id) {
  return await db.cache_productos.get(id);
}

export async function obtenerClientePorId(id) {
  return await db.cache_clientes.get(id);
}

export async function obtenerTodosProductos() {
  const productos = await db.cache_productos.toArray();
  return productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function obtenerTodosClientes() {
  return await db.cache_clientes.toArray();
}
