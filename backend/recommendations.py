"""Recomendaciones de stock basadas en velocidad de venta.

Lógica pura (sin acceso a base de datos) para poder testearla de forma aislada.
El endpoint la consume con datos agregados vía pipeline de MongoDB.
"""
import math
from datetime import datetime, timezone

from pydantic import BaseModel
from typing import List

# Umbrales de negocio
UMBRAL_DIAS_COBERTURA = 7       # reponer si el stock cubre menos de 7 días
UMBRAL_DIAS_EXCESO = 90         # exceso si el stock cubre más de 90 días
CANTIDAD_DIAS_PRONOSTICO = 7    # stock objetivo para 7 días
STOCK_MIN_EXCESO = 30           # stock mínimo para considerar exceso
PERIODO_DIAS_DEFAULT = 30       # ventana de análisis por defecto
TOP_LIMITE = 10                 # cantidad de productos en el ranking


class ProductoTop(BaseModel):
    producto_id: str
    nombre: str
    unidades: int
    monto: float


class RecomendacionReponer(BaseModel):
    producto_id: str
    nombre: str
    stock_actual: int
    unidades_vendidas_30d: int
    velocidad_diaria: float
    dias_cobertura: float
    cantidad_sugerida: int


class RecomendacionExceso(BaseModel):
    producto_id: str
    nombre: str
    stock_actual: int
    unidades_vendidas_30d: int
    velocidad_diaria: float
    dias_cobertura: float


class Recomendaciones(BaseModel):
    periodo_dias: int
    fecha_calculo: str
    top_productos: List[ProductoTop]
    a_reponer: List[RecomendacionReponer]
    exceso_stock: List[RecomendacionExceso]


def calcular(
    ventas_por_producto: dict,
    info_productos: dict,
    periodo_dias: int = PERIODO_DIAS_DEFAULT,
    now: datetime = None,
) -> Recomendaciones:
    """Calcula las recomendaciones a partir de datos ya agregados.

    Args:
        ventas_por_producto: {producto_id: {'nombre', 'unidades', 'monto'}}
        info_productos:      {producto_id: {'id', 'nombre', 'stock'}}
        periodo_dias:        ventana de días usada para la velocidad de venta.
        now:                 momento de cálculo (por defecto ahora UTC).
    """
    now = now or datetime.now(timezone.utc)

    # Top productos (por unidades vendidas)
    top = [
        {
            'producto_id': pid,
            'nombre': datos['nombre'],
            'unidades': datos['unidades'],
            'monto': datos['monto'],
        }
        for pid, datos in ventas_por_producto.items()
    ]
    top.sort(key=lambda x: x['unidades'], reverse=True)
    top = top[:TOP_LIMITE]

    # Reposición y exceso
    a_reponer = []
    exceso_stock = []

    for pid, p in info_productos.items():
        stock = int(p.get('stock', 0))
        vendido = ventas_por_producto.get(pid, {}).get('unidades', 0)
        nombre = p.get('nombre') or ventas_por_producto.get(pid, {}).get('nombre', 'Producto')
        velocidad = vendido / periodo_dias if vendido > 0 else 0.0
        dias_cobertura = (stock / velocidad) if velocidad > 0 else float('inf')

        # Reponer: tiene rotación y el stock no cubre 7 días
        if velocidad > 0 and dias_cobertura < UMBRAL_DIAS_COBERTURA:
            objetivo = math.ceil(velocidad * CANTIDAD_DIAS_PRONOSTICO)
            cantidad_sugerida = max(objetivo - stock, 0)
            a_reponer.append(
                RecomendacionReponer(
                    producto_id=pid,
                    nombre=nombre,
                    stock_actual=stock,
                    unidades_vendidas_30d=vendido,
                    velocidad_diaria=round(velocidad, 3),
                    dias_cobertura=round(dias_cobertura, 1),
                    cantidad_sugerida=cantidad_sugerida,
                )
            )

        # Exceso: stock alto con poca o ninguna rotación
        if stock >= STOCK_MIN_EXCESO and dias_cobertura > UMBRAL_DIAS_EXCESO:
            cobertura_mostrada = round(dias_cobertura, 1) if dias_cobertura != float('inf') else 999.0
            exceso_stock.append(
                RecomendacionExceso(
                    producto_id=pid,
                    nombre=nombre,
                    stock_actual=stock,
                    unidades_vendidas_30d=vendido,
                    velocidad_diaria=round(velocidad, 3),
                    dias_cobertura=cobertura_mostrada,
                )
            )

    a_reponer.sort(key=lambda x: x.dias_cobertura)
    exceso_stock.sort(key=lambda x: x.stock_actual, reverse=True)

    return Recomendaciones(
        periodo_dias=periodo_dias,
        fecha_calculo=now.isoformat(),
        top_productos=[ProductoTop(**t) for t in top],
        a_reponer=a_reponer,
        exceso_stock=exceso_stock,
    )