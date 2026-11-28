# Backup y recuperacion (MongoDB Atlas M0)

Atlas M0 (gratis) **no incluye backups**. Estos workflows son la unica copia
real de la base de produccion. `sync_db.py` y `migrate_to_atlas.py` NO son
backups: el segundo hace `drop()` de las colecciones destino.

## Que se agrego

| Workflow | Cuando hace algo | Que hace |
|---|---|---|
| `.github/workflows/backup-mongo.yml` | Diario 03:00 UTC (00:00 ART) y manual | `mongodump --gzip`, cifrado AES-256, checksum y subida a storage S3-compatible con retencion |
| `.github/workflows/backup-restore-drill.yml` | Dia 1 de cada mes 05:00 UTC y manual | Restaura el ultimo dump en una DB temporal, cuenta documentos y borra la DB temporal |
| `.github/workflows/keep-alive.yml` | Cada 9 minutos y manual | Ping a `/api/health` para evitar el cold start de Render Free |

## Secrets del repositorio (Settings → Secrets and variables → Actions)

### Comunes

| Secret | Valor |
|---|---|
| `MONGO_URL` | URI de conexion de Atlas **de produccion** (la misma que usa Render en `MONGO_URL`). Solo lectura alcanza para el dump. |
| `DB_NAME` | Nombre de la DB de produccion. |
| `BACKUP_PASSPHRASE` | Clave larga para cifrar el dump. Guardarla tambien fuera de GitHub: sin ella el backup es inutilizable. |
| `BACKUP_S3_BUCKET` | Bucket donde se suben los dumps. |
| `BACKUP_S3_ACCESS_KEY_ID` / `BACKUP_S3_SECRET_ACCESS_KEY` | Credenciales con permiso de `ListBucket`, `PutObject`, `GetObject` y `DeleteObject` solo sobre el prefijo `vinopormi/`. |
| `BACKUP_S3_REGION` | `auto` para Cloudflare R2 / B2, o la region del bucket en S3. |
| `BACKUP_S3_ENDPOINT` | **Opcional**. URL del endpoint S3-compatible (ej. `https://<cuenta>.r2.cloudflarestorage.com`). Vacío = AWS S3. |
| `BACKUP_ALERT_WEBHOOK` | **Opcional**. Webhook de Slack/Teams al que avisar si el backup falla. |

### Solo para el restore drill

| Secret | Valor |
|---|---|
| `RESTORE_MONGO_URL` | URI con permisos de escritura. Puede ser el mismo cluster; el workflow crea una DB `*_drill_<timestamp>` y la borra al final. |
| `RESTORE_DB_BASE` | Nombre base para la DB temporal (ej. `vpm_restore`). |

### Variables (no secretas)

| Variable | Valor por defecto | Uso |
|---|---|---|
| `BACKUP_RETENTION_DAYS` | `14` | Dias que se conservan los dumps. |
| `HEALTH_URL` | `https://vinopormi.onrender.com/api/health` | URL que pingea el keep-alive. |

## Probarlo antes de dormir

1. Cargar los secrets.
2. Ejecutar `Backup MongoDB (diario)` con **Run workflow** y confirmar que el
   log termine con el `ls -lh` del archivo cifrado.
3. Verificar en el storage que existan `backup-<DB>-<fecha>.archive.gz.enc` y
   su `.sha256`.
4. Ejecutar `Restore drill MongoDB (mensual)` con **Run workflow**. Tiene que
   imprimir `RESTORE DRILL OK` y `DB temporal eliminada`.

Si el drill falla, el backup no cuenta: revisar passphrase, permisos y URI.

## Restaurar de verdad (emergencia)

```bash
# 1) bajar el dump y su checksum del storage
aws s3 cp s3://<bucket>/vinopormi/<DB>/backup-...archive.gz.enc . --endpoint-url <endpoint>
aws s3 cp s3://<bucket>/vinopormi/<DB>/backup-...archive.gz.enc.sha256 .

# 2) validar y descifrar
echo "$(cut -d' ' -f1 backup-...sha256)  backup-...enc" | sha256sum -c -
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in backup-...enc -out backup.archive.gz -pass env:BACKUP_PASSPHRASE

# 3) restaurar (sin --drop si quieres conservar lo que haya en la DB)
mongorestore --uri "$MONGO_URL" --db "$DB_NAME" --gzip --archive=backup.archive.gz
```

Antes de restaurar sobre produccion, hacer un dump del estado actual para no
perder datos nuevos. Nunca subir dumps ni passphrases al repositorio.

## Clonar la base cloud a la local (`_dev`)

El script `sync_db.py` ya existe y copia datos **+ índices** conservando los
`_id`. Acepta URIs distintas para origen y destino, así que sirve para traer
Atlas a `test_database_dev` (la DB del `backend/.env` local). No hace falta
tener `mongodump`/`mongorestore` instalados: usa `pymongo`, que ya está en el
backend. `sync_db.py` es un helper local (está en `.gitignore`); el `.bat` de
la raíz ya lo invoca.

1. Obtener la URI de Atlas y el nombre de la DB de producción del panel de
   Render (Environment → `MONGO_URL` y `DB_NAME`) o de Atlas → Connect. Si Atlas
   tiene restringido el acceso por IP, agregar la IP pública actual en
   Atlas → Network Access (o `0.0.0.0/0` sólo mientras se hace la copia).

2. Simular primero (no escribe nada):

   ```powershell
   cd D:\AppServ\www\vinopormi
   $env:MONGO_URI_ORIGEN = 'URI_DE_ATLAS_CON_CREDENCIALES'
   $env:MONGO_URI_DESTINO = 'mongodb://localhost:27017'
   python sync_db.py --prod NOMBRE_DB_PROD --dev test_database_dev --dry-run
   ```

3. Si el plan es correcto, ejecutar la copia real (reemplaza `test_database_dev`):

   ```powershell
   python sync_db.py --prod NOMBRE_DB_PROD --dev test_database_dev -y
   ```

4. **Post-clon (importante):** la colección `configuracion` trae el
   `access_token` y `webhook_secret` reales de MercadoPago, y `usuarios` trae
   los hashes de producción. Si sólo querés datos para probar el dashboard,
   sacar las credenciales del clon:

   ```powershell
   python -c 'import pymongo; pymongo.MongoClient("mongodb://localhost:27017")["test_database_dev"]["configuracion"].update_one({"tipo":"mercadopago"}, {"$unset":{"access_token":"","webhook_secret":""}})'
   ```

5. Reiniciar el backend (la caché de lectura es en memoria) y recargar el front
   con hard refresh. Si el dashboard muestra números viejos, limpiar los datos
   del sitio en el navegador.

**Precaución:** el destino se vacía antes de copiar. Si hay datos de desarrollo
que querés conservar, hacé antes una copia inversa a una DB temporal, por
ejemplo `python sync_db.py --dev test_database_dev_backup -y`. Nunca subir la
URI con credenciales ni un dump al repositorio.

## Multi-comercio

Con un deploy por comercio, repetir los secrets con el `MONGO_URL`/`DB_NAME`
de cada comercio conviene hacerlo en repositorios o entornos separados de
GitHub Actions. El prefijo `vinopormi/<DB_NAME>/` ya mantiene los dumps
separados dentro del mismo bucket.
