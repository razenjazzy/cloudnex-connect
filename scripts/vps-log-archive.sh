#!/usr/bin/env bash
# Consolidated hourly log archive for Cloudnex Connect (run from root's crontab on the VPS).
#
#   /var/log/cloudnex-connect/<source>/<YYYY-MM-DD>/<HH>.log      current hour, plain text (UTC hours)
#   /var/log/cloudnex-connect/<source>/<YYYY-MM-DD>/<HH>.log.gz    closed hours, gzip
#
# Sources: <lane>-app, <lane>-redis (docker logs of each container) and edge-nginx-access / edge-nginx-error
# (only the amardhaka.io vhost, see deploy/hostinger/nginx-amardhaka.conf.example). Every line starts with a UTC
# ISO timestamp so one reader (Admin -> Logs) handles all of them.
# Hours older than 2 h are gzipped; files older than RETENTION_DAYS (default 30) are deleted.
# The folder is 750 root:<LOG_GID> (LINE user ids inside): root plus the container user group (gid 101 = "app")
# can read it, which is how Admin -> Logs reads it through a read-only mount.
set -uo pipefail

LOG_ROOT="${LOG_ROOT:-/var/log/cloudnex-connect}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
LOG_GID="${LOG_GID:-101}"
DOCKER_SOURCES="${DOCKER_SOURCES:-staging-app:cns-line-oa-staging staging-redis:cns-line-oa-staging-redis production-app:cloudnex-connect-production production-redis:cloudnex-connect-production-redis}"
NGINX_ACCESS="${NGINX_ACCESS:-/var/log/nginx/amardhaka.io.access.log}"
NGINX_ERROR="${NGINX_ERROR:-/var/log/nginx/amardhaka.io.error.log}"

umask 027
mkdir -p "$LOG_ROOT"
chmod 750 "$LOG_ROOT"

# stdin: lines that start with an ISO UTC timestamp -> <dir>/<day>/<HH>.log (continuation lines follow their parent)
write_hours() {
  local dir="$1"
  awk -v dir="$dir" '
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}/ {
      day = substr($1, 1, 10); hour = substr($1, 12, 2)
      if (!(day in made)) { system("mkdir -p \"" dir "/" day "\""); made[day] = 1 }
      target = dir "/" day "/" hour ".log"
    }
    target != "" { print >> target }
  '
}

archive_docker() {
  local source="$1" container="$2" dir state since until
  docker inspect "$container" >/dev/null 2>&1 || { echo "[log-archive] skip $source: no container $container" >&2; return; }
  dir="$LOG_ROOT/$source"
  mkdir -p "$dir"
  state="$dir/.last"
  until="$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)"
  since="$(cat "$state" 2>/dev/null || date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S.%NZ)"
  docker logs -t --since "$since" --until "$until" "$container" 2>&1 | write_hours "$dir"
  echo "$until" > "$state"
}

# Reads <file> from byte <from> up to <to> and converts it to ISO-prefixed lines. kind: access | error
nginx_lines() {
  local file="$1" from="$2" to="$3" kind="$4"
  [ "$to" -gt "$from" ] || return 0
  tail -c +"$((from + 1))" "$file" | head -c "$((to - from))" | awk -v kind="$kind" '
    kind == "access" { ts = $1; $1 = ""; print strftime("%Y-%m-%dT%H:%M:%SZ", int(ts), 1) $0; next }
    kind == "error" && match($0, /^[0-9]{4}\/[0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} /) {
      split($1, d, "/"); split($2, t, ":")
      print strftime("%Y-%m-%dT%H:%M:%SZ", mktime(d[1] " " d[2] " " d[3] " " t[1] " " t[2] " " t[3]), 1) " " substr($0, 21); next
    }
    { print }
  '
}

archive_nginx() {
  local source="$1" file="$2" kind="$3" dir state inode size old_inode old_off old_size
  [ -f "$file" ] || return 0
  dir="$LOG_ROOT/$source"
  mkdir -p "$dir"
  state="$dir/.pos"
  inode="$(stat -c %i "$file")"
  size="$(stat -c %s "$file")"
  old_inode="$inode"; old_off=0
  [ -f "$state" ] && read -r old_inode old_off < "$state"
  if [ "$old_inode" != "$inode" ]; then
    # rotated by logrotate: finish the old file (now .1), then start the new one from 0
    if [ -f "$file.1" ] && [ "$(stat -c %i "$file.1")" = "$old_inode" ]; then
      old_size="$(stat -c %s "$file.1")"
      nginx_lines "$file.1" "$old_off" "$old_size" "$kind" | write_hours "$dir"
    fi
    old_off=0
  elif [ "$size" -lt "$old_off" ]; then
    old_off=0
  fi
  nginx_lines "$file" "$old_off" "$size" "$kind" | write_hours "$dir"
  echo "$inode $size" > "$state"
}

for pair in $DOCKER_SOURCES; do archive_docker "${pair%%:*}" "${pair#*:}"; done
archive_nginx edge-nginx-access "$NGINX_ACCESS" access
archive_nginx edge-nginx-error "$NGINX_ERROR" error

# Close out old hours, then prune past the retention window.
for dir in "$LOG_ROOT"/*/; do
  [ -d "$dir" ] || continue
  find "$dir" -type f -name '*.log' -mmin +120 -exec gzip -f {} + 2>/dev/null
  find "$dir" -type f \( -name '*.log' -o -name '*.log.gz' \) -mtime +"$RETENTION_DAYS" -delete
  find "$dir" -mindepth 1 -type d -empty -delete
done

date -u +%Y-%m-%dT%H:%M:%SZ > "$LOG_ROOT/.archive-last-run"
chgrp -R "$LOG_GID" "$LOG_ROOT" 2>/dev/null || echo "[log-archive] could not chgrp $LOG_ROOT to $LOG_GID" >&2
