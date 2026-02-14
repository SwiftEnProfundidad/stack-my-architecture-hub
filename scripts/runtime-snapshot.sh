#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$HUB_ROOT/.runtime"
SNAPSHOT_DIR="$RUNTIME_DIR/snapshots"
STOP_SCRIPT="$SCRIPT_DIR/stop-hub.sh"

usage() {
  cat <<'EOF'
Uso:
  runtime-snapshot.sh backup [--name <alias>]
  runtime-snapshot.sh list
  runtime-snapshot.sh restore <latest|archivo.tar.gz>
  runtime-snapshot.sh prune <keep>

Notas:
  - Los snapshots se guardan en .runtime/snapshots/
  - restore detiene el hub antes de restaurar
  - restore limpia hub.pid/hub.port al terminar (seguridad)
  - prune mantiene los <keep> más recientes y borra el resto
EOF
}

sanitize_name() {
  local raw="$1"
  # Permite alfanumérico, punto, guion y guion bajo.
  printf '%s' "$raw" | sed -E 's/[^A-Za-z0-9._-]+/-/g'
}

backup_runtime() {
  local name="${1:-}"
  mkdir -p "$RUNTIME_DIR" "$SNAPSHOT_DIR"

  local timestamp
  timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"

  local base_name
  if [ -n "$name" ]; then
    local safe_name
    safe_name="$(sanitize_name "$name")"
    if [ -z "$safe_name" ]; then
      echo "❌ Nombre de snapshot inválido."
      exit 1
    fi
    base_name="${timestamp}-${safe_name}"
  else
    base_name="${timestamp}-runtime"
  fi

  local output="$SNAPSHOT_DIR/${base_name}.tar.gz"
  local tmpdir
  tmpdir="$(mktemp -d /tmp/stack-hub-snapshot-XXXX)"

  mkdir -p "$tmpdir/runtime"

  local files=(
    "build-hub.log"
    "build-manifest.json"
    "hub.log"
    "hub-selftest.log"
    "hub.pid"
    "hub.port"
  )

  local f
  for f in "${files[@]}"; do
    if [ -f "$RUNTIME_DIR/$f" ]; then
      cp "$RUNTIME_DIR/$f" "$tmpdir/runtime/$f"
    fi
  done

  if [ -d "$RUNTIME_DIR/build-manifests" ]; then
    cp -R "$RUNTIME_DIR/build-manifests" "$tmpdir/runtime/build-manifests"
  fi

  cat > "$tmpdir/runtime/snapshot-meta.json" <<EOF
{
  "schemaVersion": 1,
  "createdAtUtc": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "host": "$(hostname)",
  "hubRoot": "$HUB_ROOT"
}
EOF

  tar -czf "$output" -C "$tmpdir" runtime
  rm -rf "$tmpdir"
  echo "✅ Snapshot creado: $output"
}

list_snapshots() {
  mkdir -p "$SNAPSHOT_DIR"
  local entries
  entries="$(printf '%s\n' "$SNAPSHOT_DIR"/*.tar.gz(N) | sort -r)"
  if [ -z "$entries" ]; then
    echo "ℹ️ No hay snapshots en: $SNAPSHOT_DIR"
    return 0
  fi
  echo "Snapshots disponibles (más reciente primero):"
  echo "$entries"
}

prune_snapshots() {
  local keep="$1"
  mkdir -p "$SNAPSHOT_DIR"

  if ! [[ "$keep" =~ ^[0-9]+$ ]]; then
    echo "❌ Valor inválido para prune: $keep (debe ser entero >= 0)"
    exit 1
  fi

  local entries
  entries="$(printf '%s\n' "$SNAPSHOT_DIR"/*.tar.gz(N) | sort -r)"
  if [ -z "$entries" ]; then
    echo "ℹ️ No hay snapshots para podar en: $SNAPSHOT_DIR"
    return 0
  fi

  local index=0
  local deleted=0
  local kept=0
  local file

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    index=$((index + 1))
    if [ "$index" -le "$keep" ]; then
      kept=$((kept + 1))
      continue
    fi
    rm -f "$file"
    deleted=$((deleted + 1))
  done <<< "$entries"

  echo "✅ Prune completado: kept=$kept deleted=$deleted"
}

resolve_snapshot_path() {
  local ref="$1"
  mkdir -p "$SNAPSHOT_DIR"
  if [ "$ref" = "latest" ]; then
    printf '%s\n' "$SNAPSHOT_DIR"/*.tar.gz(N) | sort -r | head -n 1
    return 0
  fi
  if [ -f "$ref" ]; then
    echo "$ref"
    return 0
  fi
  if [ -f "$SNAPSHOT_DIR/$ref" ]; then
    echo "$SNAPSHOT_DIR/$ref"
    return 0
  fi
  if [ -f "$SNAPSHOT_DIR/${ref}.tar.gz" ]; then
    echo "$SNAPSHOT_DIR/${ref}.tar.gz"
    return 0
  fi
  return 1
}

restore_runtime() {
  local ref="$1"
  local snapshot
  snapshot="$(resolve_snapshot_path "$ref" || true)"
  if [ -z "$snapshot" ] || [ ! -f "$snapshot" ]; then
    echo "❌ Snapshot no encontrado: $ref"
    exit 1
  fi

  echo "🔄 Restaurando runtime desde: $snapshot"
  /bin/zsh -f "$STOP_SCRIPT" >/dev/null 2>&1 || true

  mkdir -p "$RUNTIME_DIR"
  local tmpdir
  tmpdir="$(mktemp -d /tmp/stack-hub-restore-XXXX)"

  tar -xzf "$snapshot" -C "$tmpdir"
  if [ ! -d "$tmpdir/runtime" ]; then
    rm -rf "$tmpdir"
    echo "❌ Snapshot inválido: no contiene carpeta runtime/"
    exit 1
  fi

  rm -f "$RUNTIME_DIR/build-hub.log" \
        "$RUNTIME_DIR/build-manifest.json" \
        "$RUNTIME_DIR/hub.log" \
        "$RUNTIME_DIR/hub-selftest.log" \
        "$RUNTIME_DIR/hub.pid" \
        "$RUNTIME_DIR/hub.port"
  rm -rf "$RUNTIME_DIR/build-manifests"

  cp -R "$tmpdir/runtime/." "$RUNTIME_DIR/"

  # Seguridad: limpiar estado de proceso tras restaurar snapshot.
  rm -f "$RUNTIME_DIR/hub.pid" "$RUNTIME_DIR/hub.port"
  rm -rf "$tmpdir"

  echo "✅ Runtime restaurado."
  echo "ℹ️ Se han limpiado hub.pid/hub.port por seguridad."
}

main() {
  if [ $# -lt 1 ]; then
    usage
    exit 1
  fi

  case "$1" in
    backup)
      shift
      local name=""
      if [ "${1:-}" = "--name" ]; then
        if [ -z "${2:-}" ]; then
          echo "❌ Falta valor para --name"
          exit 1
        fi
        name="$2"
        shift 2
      elif [ -n "${1:-}" ]; then
        name="$1"
        shift
      fi
      if [ $# -gt 0 ]; then
        echo "❌ Argumentos no soportados para backup: $*"
        exit 1
      fi
      backup_runtime "$name"
      ;;
    list)
      shift
      if [ $# -gt 0 ]; then
        echo "❌ Argumentos no soportados para list: $*"
        exit 1
      fi
      list_snapshots
      ;;
    restore)
      shift
      if [ -z "${1:-}" ]; then
        echo "❌ Debes indicar snapshot a restaurar (o latest)."
        exit 1
      fi
      local ref="$1"
      shift
      if [ $# -gt 0 ]; then
        echo "❌ Argumentos no soportados para restore: $*"
        exit 1
      fi
      restore_runtime "$ref"
      ;;
    prune)
      shift
      if [ -z "${1:-}" ]; then
        echo "❌ Debes indicar cuántos snapshots mantener (keep)."
        exit 1
      fi
      local keep="$1"
      shift
      if [ $# -gt 0 ]; then
        echo "❌ Argumentos no soportados para prune: $*"
        exit 1
      fi
      prune_snapshots "$keep"
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "❌ Comando desconocido: $1"
      usage
      exit 1
      ;;
  esac
}

main "$@"
