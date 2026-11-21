"""Copiar datos e indices de una base MongoDB local a Atlas (o cualquier URI).

No modifica la base de origen. Sobrescribe las colecciones del destino.

Ejemplo:
  python migrate_to_atlas.py --target-uri "mongodb+srv://user:pass@cluster.mongodb.net/" --dry-run
  python migrate_to_atlas.py --target-uri "mongodb+srv://user:pass@cluster.mongodb.net/" -y
"""
import argparse
import os

from pymongo import MongoClient
from pymongo.errors import PyMongoError

BATCH_SIZE = 500


def index_specs(collection):
    """Devuelve (claves, opciones, nombre) para cada indice excepto _id_."""
    specs = []
    for name, info in collection.index_information().items():
        if name == "_id_":
            continue
        keys = info.get("key")
        if not keys:
            continue
        options = {k: v for k, v in info.items() if k not in ("key", "v", "ns")}
        specs.append((keys, options, name))
    return specs


def copy_database(args):
    source = MongoClient(args.source_uri, serverSelectionTimeoutMS=10000)
    target_db_name = args.target_db or args.source_db
    target = MongoClient(args.target_uri, serverSelectionTimeoutMS=10000)

    source.admin.command("ping")
    target.admin.command("ping")

    sdb = source[args.source_db]
    tdb = target[target_db_name]
    names = sorted(sdb.list_collection_names())
    print("Colecciones de origen: " + (", ".join(names) or "(ninguna)"))

    plan = [(name, sdb[name].estimated_document_count()) for name in names]
    for name, count in plan:
        print("  {0}: {1} documentos".format(name, count))

    if args.dry_run:
        print("DRY RUN: no se escribio nada.")
        return

    if not args.yes:
        resp = input("Copiar y sobrescribir colecciones en el destino? [s/N] ")
        if resp.strip().lower() not in ("s", "si", "y", "yes"):
            print("Cancelado.")
            return

    for name, count in plan:
        src = sdb[name]
        dst = tdb[name]
        dst.drop()
        docs = []
        for doc in src.find({}):
            docs.append(doc)
            if len(docs) >= BATCH_SIZE:
                dst.insert_many(docs)
                docs = []
        if docs:
            dst.insert_many(docs)

        for keys, options, index_name in index_specs(src):
            try:
                dst.create_index(keys, **options)
            except PyMongoError as exc:
                print("  Aviso: no se creo el indice {0} en {1}: {2}".format(index_name, name, exc))

        print("  Copiada {0}: {1} documentos".format(name, dst.count_documents({})))

    print("Listo. Base destino: " + target_db_name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-uri",
        default=os.environ.get("SOURCE_MONGO_URL", "mongodb://localhost:27017"),
    )
    parser.add_argument(
        "--source-db",
        default=os.environ.get("SOURCE_DB_NAME", os.environ.get("DB_NAME", "test_database_dev")),
    )
    parser.add_argument("--target-uri", default=os.environ.get("ATLAS_MONGO_URL", ""))
    parser.add_argument("--target-db", default=os.environ.get("TARGET_DB_NAME", ""))
    parser.add_argument("--dry-run", action="store_true", help="Solo muestra que se copiaria")
    parser.add_argument("-y", "--yes", action="store_true", help="No pedir confirmacion")
    args = parser.parse_args()

    if not args.target_uri:
        parser.error("Falta --target-uri o la variable ATLAS_MONGO_URL")

    copy_database(args)


if __name__ == "__main__":
    main()
