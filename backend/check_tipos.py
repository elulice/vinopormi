import asyncio
from server import db

async def check():
    prods = await db.productos.find({}, {'nombre': 1, 'tipo': 1}).to_list(100)
    tipos = {}
    for p in prods:
        t = p.get('tipo', 'None')
        tipos[t] = tipos.get(t, 0) + 1
    print("Tipos de productos:", tipos)
    print("\nProductos tipo 'normal':")
    for p in prods:
        if p.get('tipo') == 'normal':
            print(f"  - {p.get('nombre')}")

asyncio.run(check())
