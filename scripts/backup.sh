#!/usr/bin/env bash
# Nightly Postgres backup to DigitalOcean Spaces (S3-compatible).
# Invoked by the compose `backup` service on a 02:00 UTC cron.
#
# Required env:
#   POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   DO_SPACES_ENDPOINT  e.g. https://nyc3.digitaloceanspaces.com
#   DO_SPACES_BUCKET    e.g. logikmarket-backups
#   DO_SPACES_ACCESS_KEY, DO_SPACES_SECRET_KEY
#   BACKUP_RETENTION_DAYS (default 14)

set -euo pipefail

TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
BACKUP_FILE="/tmp/logikmarket-${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

if [ -z "${DO_SPACES_ENDPOINT:-}" ] || [ -z "${DO_SPACES_BUCKET:-}" ]; then
  echo "[backup] DO Spaces env missing, skipping upload (keeping local dump)"
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"
pg_dump \
  --host="${POSTGRES_HOST}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip -9 > "${BACKUP_FILE}"

echo "[backup] local dump created at ${BACKUP_FILE} ($(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}") bytes)"

if [ -n "${DO_SPACES_ENDPOINT:-}" ] && [ -n "${DO_SPACES_BUCKET:-}" ] && [ -n "${DO_SPACES_ACCESS_KEY:-}" ] && [ -n "${DO_SPACES_SECRET_KEY:-}" ]; then
  export AWS_ACCESS_KEY_ID="${DO_SPACES_ACCESS_KEY}"
  export AWS_SECRET_ACCESS_KEY="${DO_SPACES_SECRET_KEY}"
  aws --endpoint-url="${DO_SPACES_ENDPOINT}" s3 cp "${BACKUP_FILE}" "s3://${DO_SPACES_BUCKET}/postgres/logikmarket-${TIMESTAMP}.sql.gz"

  # Retention: list objects older than N days and delete.
  CUTOFF="$(date -u -d "${RETENTION_DAYS} days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-"${RETENTION_DAYS}"d +%Y-%m-%dT%H:%M:%SZ)"
  aws --endpoint-url="${DO_SPACES_ENDPOINT}" s3api list-objects-v2 \
      --bucket "${DO_SPACES_BUCKET}" \
      --prefix "postgres/logikmarket-" \
      --query "Contents[?LastModified<'${CUTOFF}'].[Key]" \
      --output text | while read -r key; do
    [ -n "${key}" ] && aws --endpoint-url="${DO_SPACES_ENDPOINT}" s3 rm "s3://${DO_SPACES_BUCKET}/${key}"
  done
fi

rm -f "${BACKUP_FILE}"
echo "[backup] done"
