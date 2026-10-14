"""Tests unitarios de recommendations.py (lógica pura, sin BD)."""
import math
from datetime import datetime, timezone

import pytest

from recommendations import (
    UMBRAL_DIAS_COBERTURA,
    UMBRAL_DIAS_EXCESO,
    STOCK_MIN_EXCESO,
    TOP_LIMITE,
    calcular,
)


def build(ventas=None, productos=None, **kwargs):
    return calcular(
        ventas_por_producto=ventas or {},
        info_productos=productos or {},
        now=datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc),
        **kwargs,
    )


def test_top_se_ordena_por_unidades_descendente():
    res = build(ventas={
        "a": {"nombre": "A", "unidades": 3, "monto": 300},
        "b": {"nombre": "B", "unidades": 10, "monto": 100},
        "c": {"nombre": "C", "unidades": 5, "monto": 500},
    })
    assert [p.producto_id for p in res.top_productos] == ["b", "c", "a"]


def test_top_se_limita_a_10_productos():
    ventas = {f"p{i}": {"nombre": f"P{i}", "unidades": i, "monto": float(i)} for i in range(1, 15)}
    res = build(ventas=ventas)
    assert len(res.top_productos) == TOP_LIMITE


def test_stock_bajo_con_rotacion_se_repone():
    # 30 vendidos en 30 días => 1 u/día; stock 3 => cubre 3 días (< 7) => reponer
    res = build(
        ventas={"p1": {"nombre": "Vino", "unidades": 30, "monto": 900}},
        productos={"p1": {"id": "p1", "nombre": "Vino", "stock": 3}},
    )
    assert len(res.a_reponer) == 1
    rep = res.a_reponer[0]
    assert rep.producto_id == "p1"
    assert rep.velocidad_diaria == 1.0
    assert rep.dias_cobertura == 3.0
    # objetivo = ceil(1 * 7) = 7; cantidad_sugerida = 7 - 3 = 4
    assert rep.cantidad_sugerida == 4


def test_stock_suficiente_no_se_repone():
    # stock 7 cubre exactamente 7 días => igual al umbral, no reponer
    res = build(
        ventas={"p1": {"nombre": "Vino", "unidades": 30, "monto": 900}},
        productos={"p1": {"id": "p1", "nombre": "Vino", "stock": 7}},
    )
    assert res.a_reponer == []


def test_sin_ventas_no_se_repone():
    res = build(
        ventas={},
        productos={"p1": {"id": "p1", "nombre": "Vino", "stock": 1}},
    )
    assert res.a_reponer == []
    # exceso requiere stock minimo => tampoco
    assert res.exceso_stock == []


def test_stock_alto_sin_rotacion_es_exceso():
    res = build(
        ventas={},
        productos={"p1": {"id": "p1", "nombre": "Vino", "stock": 100}},
    )
    assert len(res.exceso_stock) == 1
    ex = res.exceso_stock[0]
    assert ex.dias_cobertura == 999.0
    assert ex.unidades_vendidas_30d == 0


def test_exceso_respeta_umbral_dias_y_stock_minimo():
    # stock 20 (<30) con 0 ventas => no es exceso
    res = build(
        ventas={},
        productos={"p1": {"id": "p1", "nombre": "Vino", "stock": STOCK_MIN_EXCESO - 1}},
    )
    assert res.exceso_stock == []

    # stock 100 pero 400 vendidos en 30 días => cobertura 7.5 días => no exceso
    res2 = build(
        ventas={"p1": {"nombre": "Vino", "unidades": 400, "monto": 4000}},
        productos={"p1": {"id": "p1", "nombre": "Vino", "stock": 100}},
    )
    assert res2.exceso_stock == []


def test_ningun_producto_no_genera_recomendaciones():
    res = build()
    assert res.top_productos == []
    assert res.a_reponer == []
    assert res.exceso_stock == []
    assert res.periodo_dias == 30
    assert res.fecha_calculo == "2025-01-15T12:00:00+00:00"


def test_periodo_personalizado_afecta_velocidad():
    # 300 vendidos en 30 días => 10 u/día; con periodo 3 => 100 u/día
    res = build(
        ventas={"p1": {"nombre": "Vino", "unidades": 300, "monto": 900}},
        productos={"p1": {"id": "p1", "nombre": "Vino", "stock": 100}},
        periodo_dias=3,
    )
    assert res.a_reponer[0].velocidad_diaria == 100.0


def test_exceso_y_reponer_no_son_mutuamente_excluyentes():
    # stock alto con cobertura entre 7 y 90 días => ni reponer ni exceso
    res = build(
        ventas={"p1": {"nombre": "Vino", "unidades": 50, "monto": 500}},
        productos={"p1": {"id": "p1", "nombre": "Vino", "stock": 50}},
    )
    assert res.a_reponer == []
    assert res.exceso_stock == []