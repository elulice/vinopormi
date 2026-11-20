"""Métricas de desempeño para el Chat IA y el panel de ranking.

Sólo lectura. Trabaja con las colecciones existentes (login_registros, ventas,
auditoria, movimientos y egresos), sin esquema nuevo.

Las fechas están persistidas como strings ISO en UTC. Se convierten a UTC-3
para agrupar por día local, igual que hace el resto del sistema.

Estimación de tiempo trabajado
------------------------------
No existe logout ni duración de sesión, así que por cada usuario y día se usa:

    inicio = primer login_registros del día
    fin    = última venta del día; si no hay ventas, se usa la última acción
             de auditoría, movimiento o egreso registrada por ese usuario

Los re-login no cuentan como fin: sólo como inicio. Si no hay eventos de
trabajo, el día se omite y se explica en el resultado. La duración se topa en
RANKING_MAX_HORAS_DIA (16 h por defecto) para no inflar el promedio.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

TZ_AR = timezone(timedelta(hours=-3))

# Presets del score del "empleado estrella". Se puede cambiar el default con
# la variable de entorno RANKING_PESOS y elegir otro desde el panel o el chat.
PESOS_PRESETS: Dict[str, Dict[str, float]] = {
    "balanceado": {
        "monto_total": 0.35,
        "cantidad_ventas": 0.25,
        "horas_trabajadas": 0.25,
        "cantidad_auditorias": 0.15,
    },
    "parejo": {
        "monto_total": 0.25,
        "cantidad_ventas": 0.25,
        "horas_trabajadas": 0.25,
        "cantidad_auditorias": 0.25,
    },
    "solo_ventas": {
        "monto_total": 0.50,
        "cantidad_ventas": 0.50,
        "horas_trabajadas": 0.0,
        "cantidad_auditorias": 0.0,
    },
}

NOMBRES_PRESETS: Dict[str, str] = {
    "balanceado": "Equilibrado (monto 35 / ventas 25 / tiempo 25 / auditoría 15)",
    "parejo": "Parejo (25% cada métrica)",
    "solo_ventas": "Sólo ventas (monto 50 / cantidad 50)",
}

ORDENES_VALIDOS = {
    "score",
    "cantidad_ventas",
    "monto_total",
    "cantidad_auditorias",
    "horas_trabajadas",
    "dias_activos",
}

METODO_EXPLICACION = (
    "El tiempo trabajado es una estimación: se mide desde el primer inicio de sesión "
    "del día hasta la última venta registrada. Si ese día no hubo ventas, se usa la "
    "última acción de auditoría, movimiento o egreso del usuario. Los re-ingresos no "
    "cuentan como salida. Los días sin actividad registrada no se incluyen y el "
    "total se topa en 16 horas por día."
)


def preset_por_defecto() -> str:
    valor = (os.environ.get("RANKING_PESOS") or "balanceado").strip().lower()
    return valor if valor in PESOS_PRESETS else "balanceado"


def max_horas_por_dia() -> float:
    try:
        valor = float(os.environ.get("RANKING_MAX_HORAS_DIA", "16") or 16)
        return valor if 1 <= valor <= 24 else 16.0
    except (TypeError, ValueError):
        return 16.0


def _a_utc(valor: Any) -> Optional[datetime]:
    if isinstance(valor, datetime):
        dt = valor
    elif isinstance(valor, str) and valor.strip():
        texto = valor.strip()
        if texto.endswith("Z"):
            texto = texto[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(texto)
        except ValueError:
            return None
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def rango_utc(desde: Optional[str] = None, hasta: Optional[str] = None) -> Tuple[str, str, str, str]:
    """Devuelve (desde_utc, hasta_utc, desde_local, hasta_local)."""
    hoy = datetime.now(TZ_AR)
    texto_desde = str(desde)[:10] if desde else (hoy - timedelta(days=30)).date().isoformat()
    texto_hasta = str(hasta)[:10] if hasta else hoy.date().isoformat()

    try:
        inicio_local = datetime.strptime(texto_desde, "%Y-%m-%d").replace(tzinfo=TZ_AR)
    except ValueError:
        inicio_local = (hoy - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
    try:
        fin_local = datetime.strptime(texto_hasta, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, microsecond=999999, tzinfo=TZ_AR
        )
    except ValueError:
        fin_local = hoy.replace(hour=23, minute=59, second=59, microsecond=999999)
    if fin_local < inicio_local:
        inicio_local, fin_local = fin_local, inicio_local

    return (
        inicio_local.astimezone(timezone.utc).isoformat(),
        fin_local.astimezone(timezone.utc).isoformat(),
        inicio_local.date().isoformat(),
        fin_local.date().isoformat(),
    )


async def _eventos(db, usuario_id: Optional[str], desde_utc: str, hasta_utc: str) -> Dict[str, List[dict]]:
    base: Dict[str, Any] = {"fecha": {"$gte": desde_utc, "$lte": hasta_utc}}
    if usuario_id:
        base["usuario_id"] = usuario_id

    colecciones = {
        "logins": ("login_registros", {"usuario_id", "usuario_nombre", "fecha"}),
        "ventas": ("ventas", {"usuario_id", "usuario_nombre", "fecha", "total"}),
        "auditoria": ("auditoria", {"usuario_id", "usuario_nombre", "fecha", "entidad", "accion"}),
        "movimientos": ("movimientos", {"usuario_id", "usuario_nombre", "fecha"}),
        "egresos": ("egresos", {"usuario_id", "usuario_nombre", "fecha", "monto"}),
    }

    resultado: Dict[str, List[dict]] = {}
    for clave, (nombre, campos) in colecciones.items():
        proyeccion = {"_id": 0}
        proyeccion.update({c: 1 for c in campos})
        resultado[clave] = await db[nombre].find(base, proyeccion).to_list(20000)
    return resultado


def _armar_dias(eventos: Dict[str, List[dict]], tope_horas: float, usuario_filtro: Optional[str] = None) -> List[dict]:
    """Agrupa los eventos por usuario y día local y calcula la duración estimada."""
    por_usuario: Dict[str, dict] = {}

    def obtener(uid: str, nombre: Optional[str]) -> dict:
        entry = por_usuario.get(uid)
        if entry is None:
            entry = {
                "usuario_id": uid,
                "nombre": nombre or uid,
                "dias": {},
                "ventas_n": 0,
                "monto_total": 0.0,
                "auditoria_n": 0,
                "movimientos_n": 0,
                "egresos_n": 0,
            }
            por_usuario[uid] = entry
        elif nombre and entry["nombre"] in (None, entry["usuario_id"]):
            entry["nombre"] = nombre
        return entry

    for doc in eventos.get("logins", []):
        uid = doc.get("usuario_id")
        if not uid or (usuario_filtro and uid != usuario_filtro):
            continue
        dt = _a_utc(doc.get("fecha"))
        if not dt:
            continue
        local = dt.astimezone(TZ_AR)
        dia = obtener(uid, doc.get("usuario_nombre"))["dias"].setdefault(
            local.date().isoformat(), {"inicio": None, "fin_venta": None, "fin_otro": None, "logins": 0}
        )
        dia["logins"] += 1
        if dia["inicio"] is None or dt < dia["inicio"]:
            dia["inicio"] = dt

    for clave, contador in (
        ("ventas", "ventas_n"),
        ("auditoria", "auditoria_n"),
        ("movimientos", "movimientos_n"),
        ("egresos", "egresos_n"),
    ):
        for doc in eventos.get(clave, []):
            uid = doc.get("usuario_id")
            if not uid or (usuario_filtro and uid != usuario_filtro):
                continue
            dt = _a_utc(doc.get("fecha"))
            if not dt:
                continue
            entry = obtener(uid, doc.get("usuario_nombre"))
            entry[contador] += 1
            if clave == "ventas":
                try:
                    entry["monto_total"] += float(doc.get("total") or 0)
                except (TypeError, ValueError):
                    pass
            local = dt.astimezone(TZ_AR)
            dia = entry["dias"].setdefault(
                local.date().isoformat(), {"inicio": None, "fin_venta": None, "fin_otro": None, "logins": 0}
            )
            # La venta manda: si hubo ventas, el fin es la última venta.
            # Recién si no hay ninguna se usa otra actividad registrada.
            clave_fin = "fin_venta" if clave == "ventas" else "fin_otro"
            if dia[clave_fin] is None or dt > dia[clave_fin]:
                dia[clave_fin] = dt

    filas: List[dict] = []
    for entry in por_usuario.values():
        dias: List[dict] = []
        for fecha, datos in sorted(entry["dias"].items()):
            inicio, fin = datos["inicio"], datos["fin_venta"] or datos["fin_otro"]
            if not inicio or not fin or fin <= inicio:
                continue
            horas = (fin - inicio).total_seconds() / 3600
            limitado = horas > tope_horas
            if limitado:
                horas = tope_horas
            dias.append(
                {
                    "fecha": fecha,
                    "inicio": inicio.astimezone(TZ_AR).strftime("%H:%M"),
                    "fin": fin.astimezone(TZ_AR).strftime("%H:%M"),
                    "horas": round(horas, 2),
                    "logins": datos["logins"],
                    "limitado": limitado,
                }
            )
        entry["dias"] = dias
        entry["total_horas"] = round(sum(d["horas"] for d in dias), 2)
        filas.append(entry)

    return sorted(filas, key=lambda f: f["nombre"].lower())


def agrupar_horas(dias: List[dict], agrupar: str = "dia") -> List[dict]:
    if agrupar not in ("dia", "semana", "mes", "total"):
        agrupar = "dia"
    if agrupar == "dia":
        return [
            {"periodo": d["fecha"], "horas": d["horas"], "dias": 1, "inicio": d["inicio"], "fin": d["fin"]}
            for d in dias
        ]

    grupos: Dict[str, dict] = {}
    for d in dias:
        if agrupar == "mes":
            clave = d["fecha"][:7]
        elif agrupar == "semana":
            iso = datetime.strptime(d["fecha"], "%Y-%m-%d").isocalendar()
            clave = f"{iso.year}-W{iso.week:02d}"
        else:
            clave = "total"
        grupo = grupos.setdefault(clave, {"periodo": clave, "horas": 0.0, "dias": 0})
        grupo["horas"] += d["horas"]
        grupo["dias"] += 1

    return [
        {"periodo": k, "horas": round(v["horas"], 2), "dias": v["dias"]}
        for k, v in sorted(grupos.items())
    ]


async def tiempo_trabajado(
    db,
    usuario_id: Optional[str] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    agrupar: str = "dia",
) -> dict:
    desde_utc, hasta_utc, desde_local, hasta_local = rango_utc(desde, hasta)
    eventos = await _eventos(db, usuario_id, desde_utc, hasta_utc)
    personas = _armar_dias(eventos, max_horas_por_dia(), usuario_id)

    if usuario_id and not personas:
        nombre = None
        doc = await db.usuarios.find_one({"id": usuario_id}, {"_id": 0, "nombre": 1, "username": 1})
        nombre = (doc or {}).get("nombre") or (doc or {}).get("username") or usuario_id
        personas = [
            {
                "usuario_id": usuario_id,
                "nombre": nombre,
                "dias": [],
                "total_horas": 0.0,
                "ventas_n": 0,
                "monto_total": 0.0,
                "auditoria_n": 0,
                "movimientos_n": 0,
                "egresos_n": 0,
            }
        ]

    usuarios = []
    for persona in personas:
        dias = persona["dias"]
        usuarios.append(
            {
                "usuario_id": persona["usuario_id"],
                "nombre": persona["nombre"],
                "total_horas": persona["total_horas"],
                "dias_activos": len(dias),
                "promedio_horas_dia": round(persona["total_horas"] / len(dias), 2) if dias else 0.0,
                "cantidad_ventas": persona["ventas_n"],
                "monto_total": round(persona["monto_total"], 2),
                "cantidad_auditorias": persona["auditoria_n"],
                "por_dia": dias,
                "por_periodo": agrupar_horas(dias, agrupar),
            }
        )

    return {
        "tipo": "tiempo",
        "periodo": {"desde": desde_local, "hasta": hasta_local, "agrupar": agrupar},
        "usuarios": usuarios,
        "cantidad_usuarios": len(usuarios),
        "total_horas_general": round(sum(u["total_horas"] for u in usuarios), 2),
        "metodo": METODO_EXPLICACION,
    }


def aplicar_score(filas: List[dict], pesos_nombre: Optional[str] = None) -> Tuple[List[dict], dict, str]:
    nombre = (pesos_nombre or preset_por_defecto()).strip().lower()
    if nombre not in PESOS_PRESETS:
        nombre = "balanceado"
    pesos = PESOS_PRESETS[nombre]

    maximos = {
        clave: max((float(f.get(clave) or 0) for f in filas), default=0.0) or 1.0
        for clave in pesos
    }

    for fila in filas:
        desglose: Dict[str, float] = {}
        total = 0.0
        for clave, peso in pesos.items():
            normalizado = min(1.0, max(0.0, float(fila.get(clave) or 0) / maximos[clave]))
            aporte = normalizado * peso
            desglose[clave] = round(aporte, 4)
            total += aporte
        fila["score"] = round(total * 100, 1)
        fila["desglose_score"] = desglose

    return filas, pesos, nombre


async def ranking(
    db,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    ordenar_por: str = "score",
    ascendente: bool = False,
    pesos_nombre: Optional[str] = None,
) -> dict:
    desde_utc, hasta_utc, desde_local, hasta_local = rango_utc(desde, hasta)
    eventos = await _eventos(db, None, desde_utc, hasta_utc)
    personas = _armar_dias(eventos, max_horas_por_dia())

    usuarios_db = await db.usuarios.find({}, {"_id": 0, "id": 1, "nombre": 1, "username": 1, "rol": 1}).to_list(200)
    por_id = {u.get("id"): u for u in usuarios_db}

    filas: List[dict] = []
    for uid, info in por_id.items():
        persona = next((p for p in personas if p["usuario_id"] == uid), None)
        if persona is None:
            continue
        filas.append(
            {
                "usuario_id": uid,
                "nombre": info.get("nombre") or persona["nombre"],
                "username": info.get("username"),
                "rol": info.get("rol", "comun"),
                "cantidad_ventas": persona["ventas_n"],
                "monto_total": round(persona["monto_total"], 2),
                "cantidad_auditorias": persona["auditoria_n"],
                "horas_trabajadas": persona["total_horas"],
                "dias_activos": len(persona["dias"]),
            }
        )

    filas, pesos, nombre_preset = aplicar_score(filas, pesos_nombre)
    clave = ordenar_por if ordenar_por in ORDENES_VALIDOS else "score"
    filas = sorted(filas, key=lambda f: (float(f.get(clave) or 0), f["nombre"].lower()), reverse=not ascendente)
    for puesto, fila in enumerate(filas, start=1):
        fila["puesto"] = puesto

    return {
        "tipo": "ranking",
        "periodo": {"desde": desde_local, "hasta": hasta_local},
        "ranking": filas,
        "ordenar_por": clave,
        "ascendente": bool(ascendente),
        "pesos": pesos,
        "pesos_preset": nombre_preset,
        "pesos_disponibles": [
            {"clave": k, "nombre": v, "valores": PESOS_PRESETS[k]}
            for k, v in NOMBRES_PRESETS.items()
        ],
        "metodo": METODO_EXPLICACION,
        "broma": "Ranking con fines humorísticos: todos los números son reales, el podio es pura ficción.",
    }
