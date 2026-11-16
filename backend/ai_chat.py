"""Herramientas y lógica de chat IA (solo lectura) para consultar datos del sistema."""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

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
MAX_MESSAGES = 12
MAX_TOOL_STEPS = 5


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


async def tool_buscar_productos(db, current_user, query: str = "", limit: int = DEFAULT_LIMIT) -> Dict[str, Any]:
    """Busca productos por nombre y devuelve precio, stock y costo."""
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    filter_query: Dict[str, Any] = {}
    if query:
        terms = [t for t in query.split() if t]
        if len(terms) > 1:
            filter_query["$and"] = [{"nombre": {"$regex": t, "$options": "i"}} for t in terms]
        else:
            filter_query["nombre"] = {"$regex": query, "$options": "i"}

    # Proyección mínima para reducir tamaño del contexto
    productos = await db.productos.find(
        filter_query,
        {"_id": 0, "nombre": 1, "precio_unitario": 1, "precio_costo": 1, "stock": 1},
    ).sort("nombre", 1).limit(limit).to_list(limit)
    out = []
    for p in productos:
        pv = p.get("precio_unitario")
        pc = p.get("precio_costo", 0)
        out.append(
            {
                "nombre": p.get("nombre"),
                "precio_venta": _fmt_money_ar(pv),
                "precio_costo": _fmt_money_ar(pc),
                "stock": p.get("stock", 0),
            }
        )
    return {"cantidad": len(out), "productos": out}


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
    limit: int = DEFAULT_LIMIT,
) -> Dict[str, Any]:
    """Lista ventas con filtros básicos y totales."""
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    match: Dict[str, Any] = {}

    # Respetar soloMisDatos (los admin ven todos los datos)
    is_admin = getattr(current_user, "rol", None) == "admin"
    if not is_admin and getattr(current_user, "preferencias", None) and current_user.preferencias.get("soloMisDatos"):
        match["usuario_id"] = current_user.id

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

    di = _parse_date_start(fecha_inicio)
    df = _parse_date_end(fecha_fin)
    if di or df:
        match["fecha"] = {}
        if di:
            match["fecha"]["$gte"] = di
        if df:
            match["fecha"]["$lte"] = df

    projection = {
        "_id": 0,
        "fecha": 1,
        "cliente_nombre": 1,
        "total": 1,
        "ganancia_neta": 1,
        "medio_pago": 1,
        "detalles": 1,
    }
    ventas = await db.ventas.find(match, projection).sort("fecha", -1).limit(limit).to_list(limit)
    total_monto = 0.0
    total_ganancia = 0.0
    out = []
    for v in ventas:
        total_monto += float(v.get("total", 0) or 0)
        total_ganancia += float(v.get("ganancia_neta", 0) or 0)
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
    count = await db.ventas.count_documents(match)
    return {
        "cantidad_mostrada": len(out),
        "cantidad_total_coincidencias": count,
        "suma_total_mostrada": _fmt_money_ar(total_monto),
        "suma_ganancia_neta_mostrada": _fmt_money_ar(total_ganancia),
        "ventas": out,
    }


async def tool_listar_egresos(
    db,
    current_user,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    limit: int = DEFAULT_LIMIT,
) -> Dict[str, Any]:
    """Lista egresos con filtros de fecha y total."""
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    match: Dict[str, Any] = {}

    # Respetar soloMisDatos (los admin ven todos los datos)
    is_admin = getattr(current_user, "rol", None) == "admin"
    if not is_admin and getattr(current_user, "preferencias", None) and current_user.preferencias.get("soloMisDatos"):
        match["usuario_id"] = current_user.id

    di = _parse_date_start(fecha_inicio)
    df = _parse_date_end(fecha_fin)
    if di or df:
        match["fecha"] = {}
        if di:
            match["fecha"]["$gte"] = di
        if df:
            match["fecha"]["$lte"] = df

    egresos = await db.egresos.find(
        match, {"_id": 0, "fecha": 1, "descripcion": 1, "monto": 1, "categoria": 1}
    ).sort("fecha", -1).limit(limit).to_list(limit)
    total = sum(float(e.get("monto", 0) or 0) for e in egresos)
    out = [
        {
            "fecha": _fmt_date_ar(e.get("fecha")),
            "descripcion": e.get("descripcion"),
            "monto": _fmt_money_ar(e.get("monto")),
            "categoria": e.get("categoria"),
        }
        for e in egresos
    ]
    count = await db.egresos.count_documents(match)
    return {
        "cantidad_mostrada": len(out),
        "cantidad_total_coincidencias": count,
        "suma_monto_mostrada": _fmt_money_ar(total),
        "egresos": out,
    }


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "buscar_productos",
            "description": "Busca productos por nombre. Devuelve precio de venta, precio de costo y stock. Usar para consultas de precios y stock.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Texto a buscar en el nombre del producto."},
                    "limit": {"type": "integer", "description": "Máximo de resultados (default 10, máx 25)."},
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
            "description": "Lista ventas con totales. Permite filtrar por rango de fechas (YYYY-MM-DD) y por cliente. Incluye monto total y ganancia neta.",
            "parameters": {
                "type": "object",
                "properties": {
                    "fecha_inicio": {"type": "string", "description": "Fecha desde (YYYY-MM-DD)."},
                    "fecha_fin": {"type": "string", "description": "Fecha hasta (YYYY-MM-DD)."},
                    "cliente": {"type": "string", "description": "Nombre o id de cliente para filtrar."},
                    "limit": {"type": "integer", "description": "Máximo de ventas a devolver."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "listar_egresos",
            "description": "Lista egresos/gastos con totales. Permite filtrar por rango de fechas (YYYY-MM-DD).",
            "parameters": {
                "type": "object",
                "properties": {
                    "fecha_inicio": {"type": "string", "description": "Fecha desde (YYYY-MM-DD)."},
                    "fecha_fin": {"type": "string", "description": "Fecha hasta (YYYY-MM-DD)."},
                    "limit": {"type": "integer", "description": "Máximo de egresos a devolver."},
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
            "description": "Consulta registros de auditoría del sistema (solo administradores). Permite filtrar por entidad (producto, cliente, egreso, usuario, etc.), acción (creado, modificado, eliminado), rango de fechas y texto.",
            "parameters": {
                "type": "object",
                "properties": {
                    "entidad": {"type": "string", "description": "Entidad a filtrar (ej. producto, cliente, egreso, usuario, venta)."},
                    "accion": {"type": "string", "description": "Acción: creado, modificado o eliminado."},
                    "fecha_inicio": {"type": "string", "description": "Fecha desde (YYYY-MM-DD)."},
                    "fecha_fin": {"type": "string", "description": "Fecha hasta (YYYY-MM-DD)."},
                    "search": {"type": "string", "description": "Texto a buscar en nombre/usuario de la entidad."},
                    "limit": {"type": "integer", "description": "Máximo de registros a devolver."},
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

    total = await db.auditoria.count_documents(filtro)
    registros = await db.auditoria.find(
        filtro,
        {"_id": 0, "fecha": 1, "entidad": 1, "entidad_nombre": 1, "accion": 1, "usuario_nombre": 1, "valores_anteriores": 1, "valores_nuevos": 1},
    ).sort("fecha", -1).limit(limit).to_list(limit)

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
        return {"error": f"Herramienta desconocida: {name}"}
    except Exception as e:
        return {"error": f"Error ejecutando {name}: {str(e)}"}


SYSTEM_PROMPT = (
    "Sos un asistente de consultas del sistema de gestión VinoPorMi. "
    "Respondé en español, de forma clara, breve y exacta. "
    "Mantené el contexto del historial de la conversación para entender referencias y preguntas de seguimiento (por ejemplo pronombres como 'él/ella/eso' o '¿de qué color?') usando lo que el usuario o vos dijeron antes en el chat. "
    "Cuando la pregunta requiera datos del sistema (ventas, productos, cuentas corrientes, proveedores, egresos, MercadoPago o auditoría), usá las herramientas disponibles y basá esos datos únicamente en sus resultados. No inventes precios, stock, saldos, montos, fechas ni registros. "
    "Distinguí entre datos del sistema (solo desde herramientas) e información conversacional aportada por el usuario en el chat: podés recordar y referirte a lo conversado, pero no lo presentes como dato del sistema. "
    "SOLO podés consultar información usando las herramientas disponibles; no podés crear, editar ni eliminar datos. "
    "Si una herramienta devuelve vacío o error, indicalo claramente. "
    "Cuando haya ambigüedad (por ejemplo varios clientes o productos), pedí aclaración mostrando las opciones devueltas. "
    "Si el usuario pide algo fuera del alcance de las herramientas o del contexto disponible, explicá brevemente la limitación. "
    "Formato (Argentina): mostrá SIEMPRE los montos como pesos argentinos con separador de miles '.' y decimales ',' (ej.: $ 1.234,56; $ 0,00). "
    "Mostrá las fechas como dd/mm/aaaa y, si hay hora, dd/mm/aaaa HH:MM. "
    "Usá exactamente los valores formateados que devuelven las herramientas, sin cambiarlos. "
    "Podés usar formato Markdown simple para mejorar la legibilidad (negritas, listas, tablas simples, etc.)."
)


async def run_chat(messages: List[Dict[str, str]], db, current_user) -> str:
    if litellm is None:
        raise HTTPException(status_code=500, detail="Dependencia de IA no disponible: litellm no está instalado.")

    model = os.environ.get("CHAT_MODEL", "gpt-4o-mini")
    api_key = os.environ.get("CHAT_API_KEY") or os.environ.get("OPENAI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    api_base = os.environ.get("CHAT_API_BASE")
    keep_alive = os.environ.get("CHAT_KEEP_ALIVE", "60m")

    # Build conversation
    convo: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    # keep last messages to limit context
    for m in (messages or [])[-MAX_MESSAGES:]:
        role = m.get("role")
        content = m.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            # recortar mensajes muy largos del historial
            convo.append({"role": role, "content": content.strip()[:4000]})

    if not any(m["role"] == "user" for m in convo):
        raise HTTPException(status_code=400, detail="Falta el mensaje del usuario")

    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": convo,
        "tools": TOOL_DEFINITIONS,
        "tool_choice": "auto",
        "temperature": 0.1,
        "timeout": 120,
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
    for _ in range(MAX_TOOL_STEPS):
        try:
            resp = litellm.completion(**kwargs)
        except Exception as e:
            msg = str(e)
            if "api key" in msg.lower() or "auth" in msg.lower() or "401" in msg or "403" in msg:
                raise HTTPException(status_code=500, detail="Falta o es inválida la API key del modelo de IA. Configurá CHAT_API_KEY/OPENAI_API_KEY (según el modelo) en backend/.env.")
            if "connect" in msg.lower() or "refused" in msg.lower() or "11434" in msg:
                raise HTTPException(status_code=500, detail="No se pudo conectar con el servidor de Ollama. Verificá que esté en ejecución y que CHAT_API_BASE sea correcto (ej. http://localhost:11434).")
            raise HTTPException(status_code=500, detail=f"Error al consultar el modelo de IA: {msg}")

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
            return (message.content or "").strip() or "No pude generar una respuesta con los datos disponibles."

        # execute tools
        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except Exception:
                args = {}
            result = await execute_tool(name, args, db, current_user)
            kwargs["messages"].append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": name,
                    "content": json.dumps(result, ensure_ascii=False, default=str),
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