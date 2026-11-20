"""Herramientas y lógica de chat IA (solo lectura) para consultar datos del sistema."""

from __future__ import annotations

import asyncio
import json
import os
import re
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from ia_metricas import (
    NOMBRES_PRESETS,
    PESOS_PRESETS,
    aplicar_score,
    preset_por_defecto,
    ranking as calcular_ranking,
    tiempo_trabajado as calcular_tiempo_trabajado,
)

try:
    import litellm  # carga anticipada para reducir latencia de la primera consulta
    try:
        litellm.suppress_debug_info = True
    except Exception:
        pass
except Exception:
    litellm = None  # type: ignore[assignment]

# Límites bajos para reducir tokens/latencia (especialmente en CPU con Ollama)
DEFAULT_LIMIT = 10
MAX_LIMIT = 25
MAX_MOVIMIENTOS = 15
MAX_MESSAGES = 8
MAX_MSG_CHARS = 1500
MAX_TOOL_RESULT_CHARS = 4000
MAX_TOOL_STEPS = 5
MAX_TOKENS = 4000  # incluye tokens de razonamiento del modelo


def _parse_date_start(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    tz_ar = timezone(timedelta(hours=-3))
    try:
        dt_local = datetime.strptime(value[:10], "%Y-%m-%d").replace(tzinfo=tz_ar)
        return dt_local.astimezone(timezone.utc).isoformat()
    except Exception:
        return None


def _parse_date_end(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    tz_ar = timezone(timedelta(hours=-3))
    try:
        dt_local = datetime.strptime(value[:10], "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, microsecond=999999, tzinfo=tz_ar
        )
        return dt_local.astimezone(timezone.utc).isoformat()
    except Exception:
        return None


def _iso(dt: Any) -> Any:
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt


def _fmt_money_ar(value: Any) -> str:
    """Formatea un monto en estilo argentino: $ 1.234,56"""
    try:
        n = float(value or 0)
    except Exception:
        return str(value)
    sign = "-" if n < 0 else ""
    n = abs(n)
    entero = int(n)
    dec = round((n - entero) * 100)
    if dec == 100:
        entero += 1
        dec = 0
    entero_str = f"{entero:,}".replace(",", ".")
    return f"{sign}$ {entero_str},{dec:02d}"


def _fmt_date_ar(value: Any, with_time: bool = False) -> str:
    """Formatea fecha a dd/mm/yyyy (y opcionalmente HH:MM)"""
    if value is None:
        return ""
    dt = value
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            # intentar quedarse con parte de fecha
            return value[:10][::-1] if False else value[:10]
    if isinstance(dt, datetime):
        # mostrar en hora local aproximada si viene con tz (simple): convertir a -03:00 si es aware
        try:
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone(timedelta(hours=-3)))
        except Exception:
            pass
        if with_time:
            return dt.strftime("%d/%m/%Y %H:%M")
        return dt.strftime("%d/%m/%Y")
    return str(value)


async def tool_buscar_productos(
    db,
    current_user,
    query: str = "",
    limit: int = DEFAULT_LIMIT,
    ordenar_por: str = "nombre",
    orden: str = "asc",
    precio_min: Optional[float] = None,
    precio_max: Optional[float] = None,
    solo_con_stock: Optional[bool] = None,
    categoria: Optional[str] = None,
    solo_con_descuento: Optional[bool] = None,
) -> Dict[str, Any]:
    """Busca productos con filtros, orden y totales básicos."""
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    filter_query: Dict[str, Any] = {}
    and_conds = []
    if query:
        terms = [t for t in str(query).split() if t]
        if len(terms) > 1:
            and_conds.append({"$and": [{"nombre": {"$regex": t, "$options": "i"}} for t in terms]})
        else:
            and_conds.append({"nombre": {"$regex": str(query), "$options": "i"}})

    if precio_min is not None or precio_max is not None:
        price_filter: Dict[str, Any] = {}
        if precio_min is not None:
            try:
                price_filter["$gte"] = float(precio_min)
            except Exception:
                pass
        if precio_max is not None:
            try:
                price_filter["$lte"] = float(precio_max)
            except Exception:
                pass
        if price_filter:
            and_conds.append({"precio_unitario": price_filter})
    if solo_con_stock is True:
        and_conds.append({"stock": {"$gt": 0}})
    if solo_con_descuento is True:
        and_conds.append({
            "descuento_cantidad_minima": {"$exists": True, "$ne": None},
            "descuento_precio_unitario": {"$exists": True, "$ne": None},
        })
    elif solo_con_descuento is False:
        and_conds.append({
            "$or": [
                {"descuento_cantidad_minima": {"$exists": False}},
                {"descuento_cantidad_minima": None},
                {"descuento_precio_unitario": {"$exists": False}},
                {"descuento_precio_unitario": None},
            ]
        })
    if categoria:
        and_conds.append({
            "$or": [
                {"categoria_nombre": {"$regex": str(categoria), "$options": "i"}},
                {"categoria": {"$regex": str(categoria), "$options": "i"}},
            ]
        })

    if len(and_conds) == 1:
        filter_query = and_conds[0]
    elif len(and_conds) > 1:
        filter_query = {"$and": and_conds}

    sort_map = {
        "nombre": "nombre",
        "precio_venta": "precio_unitario",
        "precio": "precio_unitario",
        "precio_costo": "precio_costo",
        "stock": "stock",
        "categoria": "categoria_nombre",
    }
    sort_field = sort_map.get(str(ordenar_por or "nombre").lower(), "nombre")
    sort_dir = -1 if str(orden or "asc").lower() in ("desc", "descendente", "-1") else 1

    count = await db.productos.count_documents(filter_query)
    productos = await db.productos.find(
        filter_query,
        {
            "_id": 0, "nombre": 1, "precio_unitario": 1, "precio_costo": 1,
            "stock": 1, "categoria_nombre": 1, "categoria": 1,
            "descuento_cantidad_minima": 1, "descuento_precio_unitario": 1,
        },
    ).sort(sort_field, sort_dir).limit(limit).to_list(limit)
    out = []
    for p in productos:
        pv = p.get("precio_unitario")
        pc = p.get("precio_costo", 0)
        cat = p.get("categoria_nombre") or p.get("categoria")
        cant_desc = p.get("descuento_cantidad_minima")
        precio_desc = p.get("descuento_precio_unitario")
        descuento = None
        if cant_desc is not None and precio_desc is not None:
            descuento = (
                f"Desde {cant_desc} unidades: "
                f"{_fmt_money_ar(precio_desc)} por unidad"
            )
        out.append(
            {
                "nombre": p.get("nombre"),
                "categoria": cat or "Sin categoría",
                "precio_venta": _fmt_money_ar(pv),
                "precio_costo": _fmt_money_ar(pc),
                "stock": p.get("stock", 0),
                "descuento": descuento,
            }
        )
    return {
        "cantidad_mostrada": len(out),
        "cantidad_total_coincidencias": count,
        "ordenado_por": ordenar_por,
        "orden": "asc" if sort_dir == 1 else "desc",
        "productos": out,
    }


async def _find_cliente(db, nombre_o_id: str):
    # try by id
    cliente = await db.clientes.find_one({"id": nombre_o_id}, {"_id": 0})
    if cliente:
        return cliente
    clientes = await db.clientes.find(
        {"nombre": {"$regex": nombre_o_id, "$options": "i"}}, {"_id": 0}
    ).limit(5).to_list(5)
    if len(clientes) == 1:
        return clientes[0]
    return clientes  # may be list for ambiguity or empty


async def _find_proveedor(db, nombre_o_id: str):
    proveedor = await db.proveedores.find_one({"id": nombre_o_id}, {"_id": 0})
    if proveedor:
        return proveedor
    proveedores = await db.proveedores.find(
        {"nombre": {"$regex": nombre_o_id, "$options": "i"}}, {"_id": 0}
    ).limit(5).to_list(5)
    if len(proveedores) == 1:
        return proveedores[0]
    return proveedores


async def tool_cuenta_corriente(
    db, current_user, tipo: str, nombre_o_id: str, limit_movimientos: int = MAX_MOVIMIENTOS
) -> Dict[str, Any]:
    """Obtiene saldo y movimientos de cuenta corriente de un cliente o proveedor."""
    limit_movimientos = max(1, min(int(limit_movimientos or MAX_MOVIMIENTOS), MAX_MOVIMIENTOS))
    tipo = (tipo or "cliente").lower().strip()

    if tipo == "cliente":
        found = await _find_cliente(db, nombre_o_id)
        if isinstance(found, list):
            if not found:
                return {"error": "No se encontró ningún cliente con ese nombre/id."}
            return {
                "ambiguous": True,
                "mensaje": "Hay varios clientes que coinciden. Especificá cuál.",
                "opciones": [{"nombre": c.get("nombre"), "dni": c.get("dni")} for c in found],
            }
        cliente = found
        movimientos = await db.movimientos.find(
            {"cliente_id": cliente["id"]}, {"_id": 0, "fecha": 1, "concepto": 1, "monto": 1}
        ).sort("fecha", -1).to_list(1000)
        saldo = round(sum(float(m.get("monto", 0) or 0) for m in movimientos), 2)
        movs = [
            {
                "fecha": _fmt_date_ar(m.get("fecha")),
                "concepto": m.get("concepto"),
                "monto": _fmt_money_ar(m.get("monto")),
            }
            for m in movimientos[:limit_movimientos]
        ]
        return {
            "tipo": "cliente",
            "cliente": {"nombre": cliente.get("nombre"), "dni": cliente.get("dni")},
            "saldo": _fmt_money_ar(saldo),
            "movimientos_recientes": movs,
            "total_movimientos": len(movimientos),
        }

    if tipo == "proveedor":
        found = await _find_proveedor(db, nombre_o_id)
        if isinstance(found, list):
            if not found:
                return {"error": "No se encontró ningún proveedor con ese nombre/id."}
            return {
                "ambiguous": True,
                "mensaje": "Hay varios proveedores que coinciden. Especificá cuál.",
                "opciones": [{"nombre": p.get("nombre")} for p in found],
            }
        proveedor = found
        movimientos = await db.movimientos.find(
            {"proveedor_id": proveedor["id"]}, {"_id": 0, "fecha": 1, "concepto": 1, "monto": 1}
        ).sort("fecha", -1).to_list(1000)
        saldo = round(sum(float(m.get("monto", 0) or 0) for m in movimientos), 2)
        movs = [
            {"fecha": _fmt_date_ar(m.get("fecha")), "concepto": m.get("concepto"), "monto": _fmt_money_ar(m.get("monto"))}
            for m in movimientos[:limit_movimientos]
        ]
        return {
            "tipo": "proveedor",
            "proveedor": {"nombre": proveedor.get("nombre")},
            "saldo": _fmt_money_ar(saldo),
            "movimientos_recientes": movs,
            "total_movimientos": len(movimientos),
        }

    return {"error": "tipo debe ser 'cliente' o 'proveedor'."}


async def tool_listar_ventas(
    db,
    current_user,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    cliente: Optional[str] = None,
    medio_pago: Optional[str] = None,
    usuario: Optional[str] = None,
    limit: int = DEFAULT_LIMIT,
    ordenar_por: str = "fecha",
    orden: str = "desc",
    agrupar_por: str = "ninguno",
) -> Dict[str, Any]:
    """Lista/agrupa ventas con filtros, orden y totales sobre todas las coincidencias."""
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    match: Dict[str, Any] = {}

    # Respetar soloMisDatos (los admin ven todos los datos)
    is_admin = getattr(current_user, "rol", None) == "admin"
    if not is_admin and getattr(current_user, "preferencias", None) and current_user.preferencias.get("soloMisDatos"):
        match["usuario_id"] = current_user.id

    if usuario:
        uid, error_usuario = await _resolver_usuario(db, current_user, usuario)
        if error_usuario:
            return error_usuario
        if uid != current_user.id and not is_admin:
            return {"error": "Sólo los administradores pueden consultar las ventas de otros usuarios."}
        match["usuario_id"] = uid

    if cliente:
        found = await _find_cliente(db, cliente)
        if isinstance(found, list):
            if not found:
                return {"error": "No se encontró ningún cliente con ese nombre/id."}
            return {
                "ambiguous": True,
                "mensaje": "Hay varios clientes que coinciden. Especificá cuál.",
                "opciones": [{"nombre": c.get("nombre"), "dni": c.get("dni")} for c in found],
            }
        match["cliente_id"] = found["id"]

    if medio_pago:
        match["medio_pago"] = {"$regex": f"^{re.escape(str(medio_pago).strip())}$", "$options": "i"}

    di = _parse_date_start(fecha_inicio)
    df = _parse_date_end(fecha_fin)
    if di or df:
        match["fecha"] = {}
        if di:
            match["fecha"]["$gte"] = di
        if df:
            match["fecha"]["$lte"] = df

    # Totales globales sobre todas las coincidencias
    totals_pipeline = [
        {"$match": match},
        {"$group": {"_id": None, "count": {"$sum": 1}, "total": {"$sum": {"$ifNull": ["$total", 0]}}, "ganancia": {"$sum": {"$ifNull": ["$ganancia_neta", 0]}}}},
    ]
    totals_agg = await db.ventas.aggregate(totals_pipeline).to_list(1)
    totals = totals_agg[0] if totals_agg else {"count": 0, "total": 0, "ganancia": 0}

    agrupar_por = (agrupar_por or "ninguno").lower().strip()
    group_key_map = {
        "dia": {"$substrBytes": [{"$ifNull": ["$fecha", ""]}, 0, 10]},
        "día": {"$substrBytes": [{"$ifNull": ["$fecha", ""]}, 0, 10]},
        "fecha": {"$substrBytes": [{"$ifNull": ["$fecha", ""]}, 0, 10]},
        "mes": {"$substrBytes": [{"$ifNull": ["$fecha", ""]}, 0, 7]},
        "medio_pago": {"$ifNull": ["$medio_pago", "Sin medio de pago"]},
        "cliente": {"$ifNull": ["$cliente_nombre", "Sin cliente"]},
    }

    if agrupar_por in group_key_map:
        group_pipeline = [
            {"$match": match},
            {"$group": {
                "_id": group_key_map[agrupar_por],
                "cantidad_ventas": {"$sum": 1},
                "suma_total": {"$sum": {"$ifNull": ["$total", 0]}},
                "suma_ganancia_neta": {"$sum": {"$ifNull": ["$ganancia_neta", 0]}},
            }},
            {"$sort": {"_id": 1 if str(orden).lower() == "asc" else -1}},
            {"$limit": limit},
        ]
        grupos = await db.ventas.aggregate(group_pipeline).to_list(limit)
        out_groups = []
        for g in grupos:
            key = g.get("_id") or "Sin dato"
            # formatear clave fecha si corresponde
            if agrupar_por in ("dia", "día", "fecha"):
                key_fmt = _fmt_date_ar(str(key))
            else:
                key_fmt = str(key)
            out_groups.append({
                "grupo": key_fmt,
                "cantidad_ventas": g.get("cantidad_ventas", 0),
                "suma_total": _fmt_money_ar(g.get("suma_total", 0)),
                "suma_ganancia_neta": _fmt_money_ar(g.get("suma_ganancia_neta", 0)),
            })
        return {
            "agrupado_por": "dia" if agrupar_por in ("dia", "día", "fecha") else agrupar_por,
            "cantidad_grupos_mostrados": len(out_groups),
            "cantidad_total_ventas": int(totals.get("count", 0) or 0),
            "suma_total_general": _fmt_money_ar(totals.get("total", 0)),
            "suma_ganancia_neta_general": _fmt_money_ar(totals.get("ganancia", 0)),
            "grupos": out_groups,
        }

    sort_map = {
        "fecha": "fecha",
        "total": "total",
        "ganancia_neta": "ganancia_neta",
        "ganancia": "ganancia_neta",
        "cliente": "cliente_nombre",
    }
    sort_field = sort_map.get(str(ordenar_por or "fecha").lower(), "fecha")
    sort_dir = 1 if str(orden or "desc").lower() in ("asc", "ascendente", "1") else -1

    projection = {
        "_id": 0, "fecha": 1, "cliente_nombre": 1, "total": 1,
        "ganancia_neta": 1, "medio_pago": 1, "detalles": 1,
    }
    ventas = await db.ventas.find(match, projection).sort(sort_field, sort_dir).limit(limit).to_list(limit)
    out = []
    for v in ventas:
        detalles = v.get("detalles") or []
        resumen_items = ", ".join(
            [f"{d.get('cantidad', 0)}x {d.get('producto_nombre', '')}" for d in detalles[:3]]
        )
        if len(detalles) > 3:
            resumen_items += f" (+{len(detalles)-3} más)"
        out.append(
            {
                "fecha": _fmt_date_ar(v.get("fecha"), with_time=True),
                "cliente": v.get("cliente_nombre") or "Sin cliente",
                "total": _fmt_money_ar(v.get("total")),
                "ganancia_neta": _fmt_money_ar(v.get("ganancia_neta")),
                "medio_pago": v.get("medio_pago"),
                "items": resumen_items,
            }
        )
    return {
        "cantidad_mostrada": len(out),
        "cantidad_total_coincidencias": int(totals.get("count", 0) or 0),
        "suma_total_general": _fmt_money_ar(totals.get("total", 0)),
        "suma_ganancia_neta_general": _fmt_money_ar(totals.get("ganancia", 0)),
        "ventas": out,
    }


async def tool_listar_egresos(
    db,
    current_user,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    search: Optional[str] = None,
    categoria: Optional[str] = None,
    limit: int = DEFAULT_LIMIT,
    ordenar_por: str = "fecha",
    orden: str = "desc",
    agrupar_por: str = "ninguno",
) -> Dict[str, Any]:
    """Lista/agrupa egresos con filtros, orden y totales sobre todas las coincidencias."""
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    match: Dict[str, Any] = {}

    # Respetar soloMisDatos (los admin ven todos los datos)
    is_admin = getattr(current_user, "rol", None) == "admin"
    if not is_admin and getattr(current_user, "preferencias", None) and current_user.preferencias.get("soloMisDatos"):
        match["usuario_id"] = current_user.id

    if categoria:
        match["categoria"] = {"$regex": re.escape(str(categoria).strip()), "$options": "i"}
    if search:
        match["$or"] = [
            {"descripcion": {"$regex": search, "$options": "i"}},
            {"categoria": {"$regex": search, "$options": "i"}},
        ]

    di = _parse_date_start(fecha_inicio)
    df = _parse_date_end(fecha_fin)
    if di or df:
        match["fecha"] = {}
        if di:
            match["fecha"]["$gte"] = di
        if df:
            match["fecha"]["$lte"] = df

    totals_pipeline = [
        {"$match": match},
        {"$group": {"_id": None, "count": {"$sum": 1}, "total": {"$sum": {"$ifNull": ["$monto", 0]}}}},
    ]
    totals_agg = await db.egresos.aggregate(totals_pipeline).to_list(1)
    totals = totals_agg[0] if totals_agg else {"count": 0, "total": 0}

    agrupar_por = (agrupar_por or "ninguno").lower().strip()
    group_key_map = {
        "dia": {"$substrBytes": [{"$ifNull": ["$fecha", ""]}, 0, 10]},
        "día": {"$substrBytes": [{"$ifNull": ["$fecha", ""]}, 0, 10]},
        "fecha": {"$substrBytes": [{"$ifNull": ["$fecha", ""]}, 0, 10]},
        "mes": {"$substrBytes": [{"$ifNull": ["$fecha", ""]}, 0, 7]},
        "categoria": {"$ifNull": ["$categoria", "Sin categoría"]},
    }

    if agrupar_por in group_key_map:
        group_pipeline = [
            {"$match": match},
            {"$group": {
                "_id": group_key_map[agrupar_por],
                "cantidad_egresos": {"$sum": 1},
                "suma_monto": {"$sum": {"$ifNull": ["$monto", 0]}},
            }},
            {"$sort": {"_id": 1 if str(orden).lower() == "asc" else -1}},
            {"$limit": limit},
        ]
        grupos = await db.egresos.aggregate(group_pipeline).to_list(limit)
        out_groups = []
        for g in grupos:
            key = g.get("_id") or "Sin dato"
            if agrupar_por in ("dia", "día", "fecha"):
                key_fmt = _fmt_date_ar(str(key))
            else:
                key_fmt = str(key)
            out_groups.append({
                "grupo": key_fmt,
                "cantidad_egresos": g.get("cantidad_egresos", 0),
                "suma_monto": _fmt_money_ar(g.get("suma_monto", 0)),
            })
        return {
            "agrupado_por": "dia" if agrupar_por in ("dia", "día", "fecha") else agrupar_por,
            "cantidad_grupos_mostrados": len(out_groups),
            "cantidad_total_egresos": int(totals.get("count", 0) or 0),
            "suma_monto_general": _fmt_money_ar(totals.get("total", 0)),
            "grupos": out_groups,
        }

    sort_map = {"fecha": "fecha", "monto": "monto", "descripcion": "descripcion", "categoria": "categoria"}
    sort_field = sort_map.get(str(ordenar_por or "fecha").lower(), "fecha")
    sort_dir = 1 if str(orden or "desc").lower() in ("asc", "ascendente", "1") else -1

    egresos = await db.egresos.find(
        match, {"_id": 0, "fecha": 1, "descripcion": 1, "monto": 1, "categoria": 1}
    ).sort(sort_field, sort_dir).limit(limit).to_list(limit)
    out = [
        {
            "fecha": _fmt_date_ar(e.get("fecha")),
            "descripcion": e.get("descripcion"),
            "monto": _fmt_money_ar(e.get("monto")),
            "categoria": e.get("categoria"),
        }
        for e in egresos
    ]
    return {
        "cantidad_mostrada": len(out),
        "cantidad_total_coincidencias": int(totals.get("count", 0) or 0),
        "suma_monto_general": _fmt_money_ar(totals.get("total", 0)),
        "egresos": out,
    }


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "buscar_productos",
            "description": "Busca/lista productos (query vacío = todos). Permite filtrar por nombre, categoría, rango de precio, stock y descuento por cantidad; ordenar (ej. precio_venta asc para más baratos, o por categoría). Devuelve categoría, precios, stock, descuento por cantidad (si tiene) y total de coincidencias.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Texto a buscar en el nombre. Vacío para considerar todos."},
                    "limit": {"type": "integer", "description": "Máximo de resultados (default 10, máx 25)."},
                    "ordenar_por": {"type": "string", "enum": ["nombre", "precio_venta", "precio_costo", "stock", "categoria"], "description": "Campo para ordenar."},
                    "orden": {"type": "string", "enum": ["asc", "desc"], "description": "asc = menor a mayor, desc = mayor a menor."},
                    "precio_min": {"type": "number", "description": "Precio de venta mínimo."},
                    "precio_max": {"type": "number", "description": "Precio de venta máximo."},
                    "solo_con_stock": {"type": "boolean", "description": "Si es true, solo productos con stock > 0."},
                    "categoria": {"type": "string", "description": "Filtrar por nombre de categoría."},
                    "solo_con_descuento": {"type": "boolean", "description": "Si es true, solo productos con descuento por cantidad configurado (cantidad mínima y precio unitario con descuento). Si es false, solo los que no tienen."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cuenta_corriente",
            "description": "Obtiene saldo y movimientos recientes de la cuenta corriente de un cliente o un proveedor.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tipo": {"type": "string", "enum": ["cliente", "proveedor"], "description": "Tipo de cuenta."},
                    "nombre_o_id": {"type": "string", "description": "Nombre (o parte) o id del cliente/proveedor."},
                    "limit_movimientos": {"type": "integer", "description": "Cantidad de movimientos recientes a incluir."},
                },
                "required": ["tipo", "nombre_o_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "listar_ventas",
            "description": "Consulta ventas: filtra (fechas YYYY-MM-DD, cliente, medio de pago), ordena y/o agrupa. Devuelve totales generales (todas las coincidencias). Usar agrupar_por para resúmenes (por día/mes/medio_pago/cliente).",
            "parameters": {
                "type": "object",
                "properties": {
                    "fecha_inicio": {"type": "string", "description": "Fecha desde (YYYY-MM-DD)."},
                    "fecha_fin": {"type": "string", "description": "Fecha hasta (YYYY-MM-DD)."},
                    "cliente": {"type": "string", "description": "Nombre o id de cliente."},
                    "medio_pago": {"type": "string", "description": "Medio de pago a filtrar (ej. efectivo, transferencia, posnet, cuenta_corriente)."},
                    "usuario": {"type": "string", "description": "Nombre, username o id del usuario cuyas ventas se quieren consultar (o 'yo'). Sólo administradores pueden consultar otros usuarios."},
                    "limit": {"type": "integer", "description": "Máximo de ventas o grupos a devolver (default 10, máx 25)."},
                    "ordenar_por": {"type": "string", "enum": ["fecha", "total", "ganancia_neta", "cliente"], "description": "Campo para ordenar (cuando no se agrupa)."},
                    "orden": {"type": "string", "enum": ["asc", "desc"], "description": "Dirección del orden."},
                    "agrupar_por": {"type": "string", "enum": ["ninguno", "dia", "mes", "medio_pago", "cliente"], "description": "Agrupación para obtener totales por grupo."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "listar_egresos",
            "description": "Consulta egresos/gastos: filtra (fechas YYYY-MM-DD, texto/categoría), ordena y/o agrupa. Devuelve totales generales. Usar agrupar_por para resúmenes (por día/mes/categoría).",
            "parameters": {
                "type": "object",
                "properties": {
                    "fecha_inicio": {"type": "string", "description": "Fecha desde (YYYY-MM-DD)."},
                    "fecha_fin": {"type": "string", "description": "Fecha hasta (YYYY-MM-DD)."},
                    "search": {"type": "string", "description": "Texto a buscar en descripción o categoría."},
                    "categoria": {"type": "string", "description": "Filtrar por categoría."},
                    "limit": {"type": "integer", "description": "Máximo de egresos o grupos a devolver (default 10, máx 25)."},
                    "ordenar_por": {"type": "string", "enum": ["fecha", "monto", "descripcion", "categoria"], "description": "Campo para ordenar (cuando no se agrupa)."},
                    "orden": {"type": "string", "enum": ["asc", "desc"], "description": "Dirección del orden."},
                    "agrupar_por": {"type": "string", "enum": ["ninguno", "dia", "mes", "categoria"], "description": "Agrupación para obtener totales por grupo."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buscar_transferencias_mercadopago",
            "description": "Busca transferencias/dinero recibido en MercadoPago en los últimos X minutos (consulta la API como la sección MercadoPago). Devuelve monto, fecha, estado y datos del pagador cuando están disponibles.",
            "parameters": {
                "type": "object",
                "properties": {
                    "minutos": {"type": "integer", "description": "Ventana de búsqueda en minutos hacia atrás (ej. 60, 1440, 10080). Default 60."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_auditoria",
            "description": "Consulta registros de auditoría del sistema (solo administradores). Filtra por entidad (producto, categoria, cliente, proveedor, egreso, usuario, presupuesto, etc.), acción (creado/modificado/revocado/eliminado), fechas, texto y orden por fecha.",
            "parameters": {
                "type": "object",
                "properties": {
                    "entidad": {"type": "string", "description": "Entidad (ej. producto, categoria, cliente, egreso, usuario, venta, proveedor, presupuesto)."},
                    "accion": {"type": "string", "description": "Acción: creado, modificado, revocado (links de presupuestos) o eliminado."},
                    "fecha_inicio": {"type": "string", "description": "Fecha desde (YYYY-MM-DD)."},
                    "fecha_fin": {"type": "string", "description": "Fecha hasta (YYYY-MM-DD)."},
                    "search": {"type": "string", "description": "Texto a buscar en nombre/usuario/entidad."},
                    "limit": {"type": "integer", "description": "Máximo de registros (default 10, máx 25)."},
                    "orden": {"type": "string", "enum": ["asc", "desc"], "description": "Orden por fecha (desc = más recientes primero)."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tiempo_trabajado",
            "description": "Estima las horas trabajadas por usuario usando el primer login del día y la última venta (o última acción registrada si no hay ventas). Permite agrupar por día, semana, mes o total. Un usuario común sólo puede consultarse a sí mismo; un administrador puede consultar a cualquier empleado o a todos a la vez.",
            "parameters": {
                "type": "object",
                "properties": {
                    "usuario": {"type": "string", "description": "Nombre, username o id del usuario, 'yo' para consultarse a sí mismo, o 'todos' (también puede dejarse vacío) para obtener el resumen de todos los empleados. El resumen de todos es exclusivo de administradores."},
                    "fecha_inicio": {"type": "string", "description": "Fecha desde (YYYY-MM-DD)."},
                    "fecha_fin": {"type": "string", "description": "Fecha hasta (YYYY-MM-DD)."},
                    "agrupar_por": {"type": "string", "enum": ["dia", "semana", "mes", "total"], "description": "Nivel de agrupación de las horas."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ranking_empleados",
            "description": "Ranking divertido (sólo administradores) de empleados ordenado por score, cantidad de ventas, monto vendido, horas trabajadas, días activos o acciones de auditoría. El score es configurable con el preset de pesos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "fecha_inicio": {"type": "string", "description": "Fecha desde (YYYY-MM-DD)."},
                    "fecha_fin": {"type": "string", "description": "Fecha hasta (YYYY-MM-DD)."},
                    "ordenar_por": {"type": "string", "enum": ["score", "cantidad_ventas", "monto_total", "horas_trabajadas", "dias_activos", "cantidad_auditorias"], "description": "Métrica por la que se ordena."},
                    "orden": {"type": "string", "enum": ["asc", "desc"], "description": "desc = mejor primero, asc = peor primero."},
                    "pesos": {"type": "string", "enum": ["balanceado", "parejo", "solo_ventas"], "description": "Preset de pesos del score (default: el configurado en el servidor)."},
                },
                "required": [],
            },
        },
    },
]


async def tool_buscar_transferencias_mercadopago(
    db, current_user, minutos: int = 60
) -> Dict[str, Any]:
    """Busca transferencias recibidas en MercadoPago en los últimos X minutos."""
    try:
        minutos = max(1, min(int(minutos or 60), 43200))
        mp_config = await db["configuracion"].find_one({"tipo": "mercadopago"})
        access_token = mp_config.get("access_token") if mp_config else None
        if not access_token:
            return {"error": "MercadoPago no está configurado (falta access_token)."}

        from dateutil import parser as date_parser
        from zoneinfo import ZoneInfo
        import httpx

        end_date = datetime.now(ZoneInfo("America/Argentina/Buenos_Aires"))
        start_date = end_date - timedelta(minutes=minutos)

        url = "https://api.mercadopago.com/v1/payments/search"
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        params = {"sort": "date_created", "criteria": "desc", "limit": 100}

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code != 200:
                return {"error": f"Error consultando MercadoPago (status {response.status_code})."}
            data = response.json()

        transferencias = []
        for payment in data.get("results", []):
            payment_type = payment.get("payment_type_id", "")
            operation_type = payment.get("operation_type", "")
            status = payment.get("status", "")
            date_created_str = payment.get("date_created", "")

            if date_created_str:
                try:
                    payment_date = date_parser.parse(date_created_str)
                    # normalizar comparación
                    if payment_date.tzinfo is None:
                        payment_date = payment_date.replace(tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))
                    if payment_date < start_date:
                        continue
                except Exception:
                    pass

            if (payment_type in ["bank_transfer", "account_money"] or operation_type in ["transfer", "account_fund"]) and status == "approved":
                payer = payment.get("payer", {}) or {}
                payer_extra = (payment.get("additional_info", {}) or {}).get("payer", {}) or {}
                monto = payment.get("transaction_amount", payment.get("amount", 0))
                fecha_aprob = payment.get("date_approved") or payment.get("date_created")
                nombre = payer.get("first_name") or payer.get("name") or payer_extra.get("first_name")
                apellido = payer.get("last_name") or payer.get("surname") or payer_extra.get("last_name")
                pagador = " ".join([x for x in [nombre, apellido] if x]).strip() or None
                transferencias.append({
                    "fecha": _fmt_date_ar(fecha_aprob, with_time=True),
                    "monto": _fmt_money_ar(monto),
                    "estado": status,
                    "tipo": payment_type or operation_type,
                    "descripcion": payment.get("description"),
                    "pagador": pagador,
                    "email_pagador": payer.get("email"),
                    "id_mp": payment.get("id"),
                })

        return {
            "cantidad": len(transferencias),
            "busqueda_minutos": minutos,
            "transferencias": transferencias[:MAX_LIMIT],
        }
    except Exception as e:
        return {"error": f"Error al buscar transferencias: {str(e)}"}


def _resumir_cambios(valores: Any, max_items: int = 6) -> Any:
    if not isinstance(valores, dict):
        return None
    out = {}
    for i, (k, v) in enumerate(valores.items()):
        if i >= max_items:
            out["..."] = f"+{len(valores) - max_items} campos"
            break
        if isinstance(v, (dict, list)):
            try:
                s = json.dumps(v, ensure_ascii=False, default=str)
            except Exception:
                s = str(v)
            out[k] = s[:80] + ("…" if len(s) > 80 else "")
        else:
            s = str(v)
            out[k] = s[:80] + ("…" if len(s) > 80 else "")
    return out


async def tool_consultar_auditoria(
    db,
    current_user,
    entidad: Optional[str] = None,
    accion: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = DEFAULT_LIMIT,
    orden: str = "desc",
) -> Dict[str, Any]:
    """Consulta registros de auditoría (solo administradores)."""
    if getattr(current_user, "rol", None) != "admin":
        return {"error": "No tenés permisos para consultar la auditoría (solo administradores)."}

    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    filtro: Dict[str, Any] = {}

    if entidad and entidad != "todos":
        filtro["entidad"] = entidad
    if accion and accion != "todos":
        if accion == "creado":
            filtro["accion"] = {"$in": ["creado", "crear"]}
        elif accion == "modificado":
            filtro["accion"] = {"$in": ["modificado", "actualizar"]}
        elif accion == "eliminado":
            filtro["accion"] = {"$in": ["eliminado", "eliminar"]}
        else:
            filtro["accion"] = accion

    di = _parse_date_start(fecha_inicio)
    df = _parse_date_end(fecha_fin)
    if di or df:
        filtro["fecha"] = {}
        if di:
            filtro["fecha"]["$gte"] = di
        if df:
            filtro["fecha"]["$lte"] = df

    if search:
        filtro["$or"] = [
            {"entidad_nombre": {"$regex": search, "$options": "i"}},
            {"entidad_id": {"$regex": search, "$options": "i"}},
            {"usuario_nombre": {"$regex": search, "$options": "i"}},
        ]

    sort_dir = 1 if str(orden or "desc").lower() in ("asc", "ascendente", "1") else -1
    total = await db.auditoria.count_documents(filtro)
    registros = await db.auditoria.find(
        filtro,
        {"_id": 0, "fecha": 1, "entidad": 1, "entidad_nombre": 1, "accion": 1, "usuario_nombre": 1, "valores_anteriores": 1, "valores_nuevos": 1},
    ).sort("fecha", sort_dir).limit(limit).to_list(limit)

    out = []
    for r in registros:
        item = {
            "fecha": _fmt_date_ar(r.get("fecha"), with_time=True),
            "entidad": r.get("entidad"),
            "entidad_nombre": r.get("entidad_nombre"),
            "accion": r.get("accion"),
            "usuario": r.get("usuario_nombre"),
        }
        va = _resumir_cambios(r.get("valores_anteriores"))
        vn = _resumir_cambios(r.get("valores_nuevos"))
        if va:
            item["valores_anteriores"] = va
        if vn:
            item["valores_nuevos"] = vn
        out.append(item)

    return {
        "cantidad_mostrada": len(out),
        "cantidad_total_coincidencias": total,
        "registros": out,
    }


async def _resolver_usuario(db, current_user, nombre_o_id: str):
    """Devuelve (usuario_id, error). Acepta 'yo', id, nombre o username."""
    texto = str(nombre_o_id or "").strip()
    if not texto or texto.lower() in ("yo", "mí", "mi", "mio", "mia", "me"):
        return current_user.id, None

    exactos = await db.usuarios.find(
        {
            "$or": [
                {"id": texto},
                {"nombre": {"$regex": f"^{re.escape(texto)}$", "$options": "i"}},
                {"username": {"$regex": f"^{re.escape(texto)}$", "$options": "i"}},
            ]
        },
        {"_id": 0, "id": 1, "nombre": 1, "username": 1},
    ).to_list(5)
    if len(exactos) == 1:
        return exactos[0]["id"], None
    if len(exactos) > 1:
        return None, {
            "ambiguous": True,
            "mensaje": "Hay varios usuarios que coinciden. Especificá cuál.",
            "opciones": [{"nombre": u.get("nombre"), "username": u.get("username")} for u in exactos],
        }

    parecidos = await db.usuarios.find(
        {
            "$or": [
                {"nombre": {"$regex": re.escape(texto), "$options": "i"}},
                {"username": {"$regex": re.escape(texto), "$options": "i"}},
            ]
        },
        {"_id": 0, "id": 1, "nombre": 1, "username": 1},
    ).to_list(10)
    if not parecidos:
        return None, {"error": f"No se encontró ningún usuario llamado '{texto}'."}
    if len(parecidos) == 1:
        return parecidos[0]["id"], None
    return None, {
        "ambiguous": True,
        "mensaje": "Hay varios usuarios que coinciden. Especificá cuál.",
        "opciones": [{"nombre": u.get("nombre"), "username": u.get("username")} for u in parecidos],
    }


def _con_datos(resultado: Dict[str, Any], tipo: str) -> Dict[str, Any]:
    """Marca un resultado para que el endpoint del chat lo devuelva estructurado."""
    salida = {k: v for k, v in resultado.items() if k != "_structured"}
    salida["_structured"] = resultado
    salida["_tipo"] = tipo
    return salida


def _quitar_tablas_markdown(texto: str) -> str:
    """Quita tablas Markdown del texto cuando el frontend ya dibuja una tabla propia."""
    lineas = (texto or "").split("\n")
    salida = []
    i = 0

    def es_fila(linea: str) -> bool:
        t = (linea or "").strip()
        return "|" in t and not t.startswith("-") and not re.match(r"^\d+\.", t)

    while i < len(lineas):
        if (
            es_fila(lineas[i])
            and i + 1 < len(lineas)
            and re.match(r"^\s*\|?\s*:?-{2,}", lineas[i + 1])
        ):
            i += 2
            while i < len(lineas) and es_fila(lineas[i]):
                i += 1
            continue
        salida.append(lineas[i])
        i += 1
    return "\n".join(salida).strip()


def _resumen_tiempo(datos: Dict[str, Any]) -> Dict[str, Any]:
    lineas = []
    for usuario in datos["usuarios"]:
        lineas.append(
            f"**{usuario['nombre']}**: {usuario['total_horas']:.2f} h en {usuario['dias_activos']} días "
            f"(promedio {usuario['promedio_horas_dia']:.2f} h/día), "
            f"{usuario['cantidad_ventas']} ventas por {_fmt_money_ar(usuario['monto_total'])}."
        )
        periodos = usuario.get("por_periodo") or []
        if periodos and datos["periodo"]["agrupar"] != "dia":
            detalle = ", ".join(
                f"{p['periodo']}: {p['horas']:.2f} h ({p['dias']} días)" for p in periodos
            )
            lineas.append(f"  - Por {datos['periodo']['agrupar']}: {detalle}")
        elif periodos:
            detalle = ", ".join(f"{p['periodo']}: {p['horas']:.2f} h" for p in periodos[-10:])
            lineas.append(f"  - Últimos días: {detalle}")
    if len(datos.get("usuarios") or []) > 1:
        lineas.append(
            f"Total general: {datos.get('total_horas_general', 0):.2f} h "
            f"entre {datos.get('cantidad_usuarios', len(datos['usuarios']))} usuarios."
        )
    return {
        "periodo": datos["periodo"],
        "resumen": "\n".join(lineas) if lineas else "No hay eventos registrados en el rango.",
        "metodo": datos["metodo"],
    }


def _resumen_ranking(datos: Dict[str, Any]) -> Dict[str, Any]:
    # El frontend dibuja la tabla estructurada aparte. Al modelo le va sólo un
    # resumen en lenguaje natural para que no repita la tabla en Markdown.
    lineas = []
    for f in datos["ranking"]:
        lineas.append(
            f"- {f['nombre']}: puesto {f['puesto']}, score {f['score']}, "
            f"{f['cantidad_ventas']} ventas por {_fmt_money_ar(f['monto_total'])}, "
            f"{f['horas_trabajadas']:.2f} h, {f['dias_activos']} días, "
            f"{f['cantidad_auditorias']} auditorías."
        )
    return {
        "periodo": datos["periodo"],
        "resumen": "\n".join(lineas),
        "orden": f"{datos['ordenar_por']} ({'ascendente' if datos['ascendente'] else 'descendente'})",
        "pesos": NOMBRES_PRESETS.get(datos["pesos_preset"], datos["pesos_preset"]),
        "metodo": datos["metodo"],
        "broma": datos["broma"],
    }


USUARIO_TODOS = {
    "todos",
    "todo",
    "todas",
    "todos los usuarios",
    "todos los empleados",
    "todo el personal",
    "empleados",
    "personal",
    "equipo",
    "all",
    "*",
}


async def tool_tiempo_trabajado(
    db,
    current_user,
    usuario: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    agrupar_por: str = "dia",
) -> Dict[str, Any]:
    """Horas trabajadas estimadas por día, semana, mes o en total."""
    es_admin = getattr(current_user, "rol", None) == "admin"
    texto = str(usuario or "").strip().lower()

    # Un administrador puede pedir el resumen de todos con 'todos' o dejando
    # el parámetro vacío. Para consultarse a sí mismo debe usar 'yo'.
    if texto in USUARIO_TODOS:
        if not es_admin:
            return {"error": "Sólo los administradores pueden consultar las métricas de todos los usuarios."}
        uid = None
    elif texto == "":
        uid = None if es_admin else current_user.id
    else:
        uid, error = await _resolver_usuario(db, current_user, usuario)
        if error:
            return error
        if uid != current_user.id and not es_admin:
            return {"error": "Sólo los administradores pueden consultar las métricas de otros usuarios."}

    datos = await calcular_tiempo_trabajado(db, uid, fecha_inicio, fecha_fin, agrupar_por)
    salida = _resumen_tiempo(datos)
    salida["_structured"] = datos
    return salida


async def tool_ranking_empleados(
    db,
    current_user,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    ordenar_por: str = "score",
    orden: str = "desc",
    pesos: Optional[str] = None,
) -> Dict[str, Any]:
    """Ranking divertido de empleados, basado en métricas reales."""
    if getattr(current_user, "rol", None) != "admin":
        return {"error": "El ranking de empleados es exclusivo de administradores."}
    datos = await calcular_ranking(
        db, fecha_inicio, fecha_fin, ordenar_por, str(orden).lower() == "asc", pesos
    )
    salida = _resumen_ranking(datos)
    salida["_structured"] = datos
    return salida


async def execute_tool(name: str, args: Dict[str, Any], db, current_user) -> Dict[str, Any]:
    try:
        if name == "buscar_productos":
            return await tool_buscar_productos(db, current_user, **args)
        if name == "cuenta_corriente":
            return await tool_cuenta_corriente(db, current_user, **args)
        if name == "listar_ventas":
            return await tool_listar_ventas(db, current_user, **args)
        if name == "listar_egresos":
            return await tool_listar_egresos(db, current_user, **args)
        if name == "buscar_transferencias_mercadopago":
            return await tool_buscar_transferencias_mercadopago(db, current_user, **args)
        if name == "consultar_auditoria":
            return await tool_consultar_auditoria(db, current_user, **args)
        if name == "tiempo_trabajado":
            return await tool_tiempo_trabajado(db, current_user, **args)
        if name == "ranking_empleados":
            return await tool_ranking_empleados(db, current_user, **args)
        return {"error": f"Herramienta desconocida: {name}"}
    except Exception as e:
        return {"error": f"Error ejecutando {name}: {str(e)}"}


SYSTEM_PROMPT = (
    "Sos un asistente de consultas del sistema de gestión VinoPorMi. "
    "Respondé en español, de forma clara, breve y exacta. "
    "Mantené el contexto del historial de la conversación para entender referencias y preguntas de seguimiento (por ejemplo pronombres como 'él/ella/eso' o '¿de qué color?') usando lo que el usuario o vos dijeron antes en el chat. "
    "Cuando la pregunta requiera datos del sistema (ventas, productos, cuentas corrientes de clientes/proveedores, egresos, MercadoPago, auditoría, horas trabajadas o ranking de empleados), usá las herramientas disponibles y basá esos datos únicamente en sus resultados. No inventes precios, stock, saldos, montos, fechas ni registros. "
    "Aprovechá los parámetros de las herramientas cuando ayude: filtros (fechas, cliente, medio de pago, categoría, búsqueda, rangos, stock, descuento), orden (asc/desc por precio, fecha, monto, etc.) y agrupaciones/resúmenes (por día, mes, medio de pago, cliente, categoría) para responder totales y comparaciones de forma precisa. "
    "Sobre los descuentos: un producto puede tener 'descuento por cantidad', que significa que si se compra una cantidad MAYOR O IGUAL a la cantidad mínima, el precio por unidad pasa a ser el precio con descuento (no es un porcentaje). En los resultados de buscar_productos, el campo 'descuento' indica 'Desde X unidades: $Y por unidad' cuando existe y es null cuando el producto no tiene descuento. Cuando te pregunten por descuentos, usá el filtro solo_con_descuento y explicá siempre la condición (desde cuántas unidades) y el precio unitario resultante, sin confundirlo con el precio de venta normal. "
    "Distinguí entre datos del sistema (solo desde herramientas) e información conversacional aportada por el usuario en el chat: podés recordar y referirte a lo conversado, pero no lo presentes como dato del sistema. "
    "SOLO podés consultar información usando las herramientas disponibles; no podés crear, editar ni eliminar datos. "
    "Si una herramienta devuelve vacío o error, indicalo claramente. "
    "Cuando haya ambigüedad (por ejemplo varios clientes o productos), pedí aclaración mostrando las opciones devueltas. "
    "Si el usuario pide algo fuera del alcance de las herramientas o del contexto disponible, explicá brevemente la limitación. "
    "Formato (Argentina): mostrá SIEMPRE los montos como pesos argentinos con separador de miles '.' y decimales ',' (ej.: $ 1.234,56; $ 0,00). "
    "Mostrá las fechas como dd/mm/aaaa y, si hay hora, dd/mm/aaaa HH:MM. "
    "Usá exactamente los valores formateados que devuelven las herramientas, sin cambiarlos. "
    "Podés usar formato Markdown simple para mejorar la legibilidad (negritas, listas, tablas, etc.). "
    "Para listados de varios registros usá tablas Markdown cuando ayude a comparar; si hay descripciones largas o pocos ítems, preferí listas con viñetas y negritas para facilitar la lectura. "
    "Para consultas por usuario usá el parámetro 'usuario' de listar_ventas o tiempo_trabajado: acepta nombre, username, id o 'yo'. En tiempo_trabajado, si querés el total de TODOS los empleados usá 'todos' (o dejá el parámetro vacío); para consultar tus propias horas siendo administrador usá 'yo' explícitamente. Un usuario común sólo puede consultarse a sí mismo; si pide datos de otro o de todos, explicá que esa información es exclusiva de administradores y NO digas que la herramienta no puede hacerlo. "
    "Sobre el tiempo trabajado: es una estimación (primer login del día hasta la última venta, o última acción registrada si no hay ventas), no un dato exacto de asistencia; aclaralo cuando lo menciones. "
    "El ranking de empleados (sólo administradores) es un chiste con números reales: podés usar un tono divertido y elegante, felicitar al ganador y alentar al resto, pero nunca inventes métricas ni cambies el orden devuelto por la herramienta. "
    "Cuando el usuario pida ordenar de 'mejor a peor' usá orden 'desc' (en 'peor a mejor', 'asc') y mostrá el ranking con su score y el preset de pesos utilizado. "
    "Cuando uses las herramientas de métricas (tiempo_trabajado o ranking_empleados), el frontend muestra una tabla estructurada con los datos: respondé con un resumen breve en lenguaje natural y NO repitas la tabla completa en Markdown."
)


def _is_rate_limit_error(err: Exception) -> bool:
    if litellm is not None:
        rate_err_cls = getattr(litellm, "RateLimitError", None)
        if rate_err_cls and isinstance(err, rate_err_cls):
            return True
    msg = str(err).lower()
    return (
        "rate limit" in msg
        or "ratelimit" in msg
        or "rate_limit_exceeded" in msg
        or " 429" in msg
        or "status code 429" in msg
    )


def _extract_retry_seconds(err: Exception) -> Optional[float]:
    msg = str(err)
    m = re.search(r"try again in ([\d.]+)\s*s", msg, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1))
        except Exception:
            pass
    m = re.search(r"retry[- ]?after[:\s]+([\d.]+)", msg, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1))
        except Exception:
            pass
    return None


async def run_chat(messages: List[Dict[str, str]], db, current_user, collector: Optional[Dict[str, Any]] = None) -> str:
    if litellm is None:
        raise HTTPException(status_code=500, detail="Dependencia de IA no disponible: litellm no está instalado.")

    model = os.environ.get("CHAT_MODEL", "gpt-4o-mini")
    api_key = os.environ.get("CHAT_API_KEY") or os.environ.get("OPENAI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    api_base = os.environ.get("CHAT_API_BASE")
    keep_alive = os.environ.get("CHAT_KEEP_ALIVE", "60m")

    # Build conversation
    convo: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    # keep last messages to limit context
    max_messages = int(os.environ.get("CHAT_MAX_MESSAGES", str(MAX_MESSAGES)) or MAX_MESSAGES)
    max_msg_chars = int(os.environ.get("CHAT_MAX_MSG_CHARS", str(MAX_MSG_CHARS)) or MAX_MSG_CHARS)
    for m in (messages or [])[-max_messages:]:
        role = m.get("role")
        content = m.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            # recortar mensajes muy largos del historial
            convo.append({"role": role, "content": content.strip()[:max_msg_chars]})

    if not any(m["role"] == "user" for m in convo):
        raise HTTPException(status_code=400, detail="Falta el mensaje del usuario")

    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": convo,
        "tools": TOOL_DEFINITIONS,
        "tool_choice": "auto",
        "temperature": 0.1,
        "timeout": 120,
        "max_tokens": MAX_TOKENS,
    }
    if api_key:
        kwargs["api_key"] = api_key
    if api_base:
        kwargs["api_base"] = api_base

    # Mantener el modelo cargado en Ollama para evitar recargas lentas
    model_l = (model or "").lower()
    if model_l.startswith("ollama/") or model_l.startswith("ollama_chat/"):
        kwargs["keep_alive"] = keep_alive

    # Tool-calling loop
    max_tool_chars = int(os.environ.get("CHAT_MAX_TOOL_RESULT_CHARS", str(MAX_TOOL_RESULT_CHARS)) or MAX_TOOL_RESULT_CHARS)
    for _ in range(MAX_TOOL_STEPS):
        resp = None
        for attempt in range(2):
            try:
                # litellm.completion es síncrona: hacerla en un thread aparte
                # para no bloquear el event loop mientras responde el modelo.
                resp = await asyncio.to_thread(litellm.completion, **kwargs)
                break
            except Exception as e:
                if _is_rate_limit_error(e):
                    wait_s = _extract_retry_seconds(e)
                    if attempt == 0 and wait_s is not None and 0 < wait_s <= 25:
                        await asyncio.sleep(wait_s + 0.5)
                        continue
                    secs = int(round(wait_s)) if wait_s is not None and wait_s > 0 else None
                    if secs:
                        detail = f"Límite de tokens por minuto alcanzado. Reintentá en ~{secs} segundos."
                    else:
                        detail = "Límite de tokens por minuto alcanzado. Esperá unos segundos y reintentá."
                    raise HTTPException(status_code=429, detail=detail)

                msg = str(e)
                if "api key" in msg.lower() or "auth" in msg.lower() or "401" in msg or "403" in msg:
                    raise HTTPException(status_code=500, detail="Falta o es inválida la API key del modelo de IA. Configurá CHAT_API_KEY/OPENAI_API_KEY (según el modelo) en backend/.env.")
                if "connect" in msg.lower() or "refused" in msg.lower() or "11434" in msg:
                    raise HTTPException(status_code=500, detail="No se pudo conectar con el servidor de Ollama. Verificá que esté en ejecución y que CHAT_API_BASE sea correcto (ej. http://localhost:11434).")
                raise HTTPException(status_code=500, detail=f"Error al consultar el modelo de IA: {msg}")
        if resp is None:
            raise HTTPException(status_code=500, detail="No se pudo obtener respuesta del modelo de IA.")

        choice = resp.choices[0]
        message = choice.message
        tool_calls = getattr(message, "tool_calls", None) or []

        # append assistant message preserving provider-specific fields (p.ej. thought_signature de Gemini)
        if hasattr(message, "model_dump"):
            assistant_msg = message.model_dump(exclude_none=True)
        elif hasattr(message, "dict"):
            assistant_msg = message.dict(exclude_none=True)
        else:
            assistant_msg = {"role": "assistant", "content": getattr(message, "content", "") or ""}
            if tool_calls:
                serialized_tcs = []
                for tc in tool_calls:
                    if hasattr(tc, "model_dump"):
                        serialized_tcs.append(tc.model_dump(exclude_none=True))
                    elif hasattr(tc, "dict"):
                        serialized_tcs.append(tc.dict(exclude_none=True))
                    else:
                        serialized_tcs.append(
                            {
                                "id": getattr(tc, "id", ""),
                                "type": "function",
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments,
                                },
                            }
                        )
                assistant_msg["tool_calls"] = serialized_tcs
        assistant_msg.setdefault("role", "assistant")
        if assistant_msg.get("content") is None:
            assistant_msg["content"] = ""
        kwargs["messages"].append(assistant_msg)

        if not tool_calls:
            respuesta = (message.content or "").strip() or "No pude generar una respuesta con los datos disponibles."
            if collector is not None and collector.get("ultimo"):
                respuesta = _quitar_tablas_markdown(respuesta)
            return respuesta

        # execute tools
        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except Exception:
                args = {}
            result = await execute_tool(name, args, db, current_user)
            if collector is not None and isinstance(result, dict) and result.get("_structured"):
                collector["ultimo"] = {
                    "tipo": result.get("_tipo") or result["_structured"].get("tipo"),
                    "datos": result["_structured"],
                }
            # El payload estructurado va al frontend por fuera del texto; al modelo
            # le llega sólo la versión resumida para no gastar tokens de más.
            resultado_para_modelo = {
                k: v for k, v in result.items() if k not in ("_structured", "_tipo")
            }
            content = json.dumps(resultado_para_modelo, ensure_ascii=False, default=str)
            if len(content) > max_tool_chars:
                content = content[:max_tool_chars] + "\n...[resultado recortado por tamaño]"
            kwargs["messages"].append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": name,
                    "content": content,
                }
            )

    return "No pude completar la consulta (demasiados pasos). Probá reformular la pregunta de forma más específica."


async def warmup_chat_model() -> None:
    """Dispara una consulta mínima en segundo plano para reducir la latencia de la primera consulta real."""
    if litellm is None:
        return
    model = os.environ.get("CHAT_MODEL", "gpt-4o-mini")
    api_key = os.environ.get("CHAT_API_KEY") or os.environ.get("OPENAI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    api_base = os.environ.get("CHAT_API_BASE")
    keep_alive = os.environ.get("CHAT_KEEP_ALIVE", "60m")
    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Respondé solo: ok"},
            {"role": "user", "content": "ping"},
        ],
        "temperature": 0,
        "max_tokens": 1,
        "timeout": 30,
    }
    if api_key:
        kwargs["api_key"] = api_key
    if api_base:
        kwargs["api_base"] = api_base
    model_l = (model or "").lower()
    if model_l.startswith("ollama/") or model_l.startswith("ollama_chat/"):
        kwargs["keep_alive"] = keep_alive
    try:
        await asyncio.to_thread(litellm.completion, **kwargs)
    except Exception:
        # Warm-up best-effort: no debe impedir el arranque ni afectar al usuario
        return


async def transcribe_audio(file_bytes: bytes, filename: str = "audio.webm", content_type: str = "") -> str:
    """Transcribe audio a texto usando el proveedor configurado (Groq Whisper por defecto)."""
    if litellm is None:
        raise HTTPException(
            status_code=503,
            detail="El servicio de transcripción no está disponible (falta dependencia/configuración).",
        )
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El audio está vacío.")

    model = os.environ.get("CHAT_TRANSCRIBE_MODEL", "groq/whisper-large-v3-turbo")
    api_key = os.environ.get("GROQ_API_KEY") or os.environ.get("CHAT_API_KEY") or os.environ.get("OPENAI_API_KEY")
    api_base = os.environ.get("CHAT_API_BASE")

    suffix = Path(filename or "").suffix
    if not suffix:
        ct = (content_type or "").lower()
        if "mp4" in ct or "m4a" in ct:
            suffix = ".m4a"
        elif "ogg" in ct:
            suffix = ".ogg"
        elif "wav" in ct:
            suffix = ".wav"
        elif "mpeg" in ct or "mp3" in ct:
            suffix = ".mp3"
        else:
            suffix = ".webm"

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        kwargs: Dict[str, Any] = {
            "model": model,
            "file": open(tmp_path, "rb"),
            "language": "es",
            "temperature": 0,
        }
        if api_key:
            kwargs["api_key"] = api_key
        if api_base:
            kwargs["api_base"] = api_base

        try:
            try:
                resp = await litellm.atranscription(**kwargs)
            except TypeError:
                # compat: si atranscription no acepta ciertos args, caer a sync en hilo
                resp = await asyncio.to_thread(litellm.transcription, **kwargs)
        finally:
            try:
                kwargs["file"].close()
            except Exception:
                pass

        text = ""
        if resp is None:
            text = ""
        elif isinstance(resp, str):
            text = resp
        elif isinstance(resp, dict):
            text = resp.get("text") or resp.get("transcript") or ""
        else:
            text = getattr(resp, "text", None) or getattr(resp, "transcript", None) or ""
            if not text and hasattr(resp, "model_dump"):
                try:
                    d = resp.model_dump()
                    text = d.get("text") or d.get("transcript") or ""
                except Exception:
                    text = ""
        return (text or "").strip()
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if "api_key" in msg.lower() or "authentication" in msg.lower() or "401" in msg:
            raise HTTPException(status_code=502, detail="No se pudo autenticar con el servicio de transcripción.")
        raise HTTPException(status_code=502, detail=f"Error al transcribir el audio: {msg[:200]}")
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except Exception:
                pass