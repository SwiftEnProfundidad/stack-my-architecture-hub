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
  runtime-snapshot.sh backup [--name <alias>] [--keep <n>]
  runtime-snapshot.sh list
  runtime-snapshot.sh verify <latest|archivo.tar.gz>
  runtime-snapshot.sh restore <latest|archivo.tar.gz>
  runtime-snapshot.sh prune <keep>

Notas:
  - Los snapshots se guardan en .runtime/snapshots/
  - backup genera hash sidecar .sha256
  - verify valida sidecar + estructura + hashes internos
  - restore detiene el hub antes de restaurar
  - restore ejecuta verify antes de restaurar
  - restore limpia hub.pid/hub.port al terminar (seguridad)
  - prune mantiene los <keep> más recientes y borra el resto
  - backup puede autoprunear con --keep o STACK_MY_ARCH_RUNTIME_BACKUP_KEEP
EOF
}

sanitize_name() {
  local raw="$1"
  # Permite alfanumérico, punto, guion y guion bajo.
  printf '%s' "$raw" | sed -E 's/[^A-Za-z0-9._-]+/-/g'
}

validate_keep_value() {
  local keep="$1"
  if ! [[ "$keep" =~ ^[0-9]+$ ]]; then
    echo "❌ Valor inválido para keep/prune: $keep (debe ser entero >= 0)"
    exit 1
  fi
}

write_archive_checksum() {
  local archive="$1"
  local sidecar="${archive}.sha256"
  shasum -a 256 "$archive" | awk '{print $1}' > "$sidecar"
  echo "✅ Checksum generado: $sidecar"
}

verify_archive_checksum() {
  local archive="$1"
  local sidecar="${archive}.sha256"
  if [ ! -f "$sidecar" ]; then
    echo "⚠️  No existe sidecar checksum para snapshot: $sidecar"
    return 0
  fi

  local expected actual
  expected="$(awk 'NR==1{print $1}' "$sidecar" | tr -d '\r\n')"
  actual="$(shasum -a 256 "$archive" | awk '{print $1}')"
  if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
    echo "❌ Checksum inválido para snapshot: $archive"
    echo "   expected=$expected"
    echo "   actual=$actual"
    return 1
  fi
  echo "✅ Checksum válido: $sidecar"
}

write_runtime_files_manifest() {
  local runtime_dir="$1"
  local manifest="$runtime_dir/snapshot-files.sha256"
  (
    cd "$runtime_dir"
    find . -type f ! -name 'snapshot-files.sha256' -print0 \
      | sort -z \
      | xargs -0 shasum -a 256 > "$manifest"
  )
}

verify_runtime_files_manifest() {
  local runtime_dir="$1"
  local manifest="$runtime_dir/snapshot-files.sha256"
  if [ ! -f "$manifest" ]; then
    echo "⚠️  Snapshot sin manifest interno de archivos: $manifest"
    return 0
  fi
  (
    cd "$runtime_dir"
    shasum -a 256 -c "snapshot-files.sha256"
  )
  echo "✅ Hashes internos validados."
}

backup_runtime() {
  local name="${1:-}"
  local keep_override="${2:-}"
  local keep_after_backup="${keep_override:-${STACK_MY_ARCH_RUNTIME_BACKUP_KEEP:-}}"

  if [ -n "$keep_after_backup" ]; then
    validate_keep_value "$keep_after_backup"
  fi

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

  write_runtime_files_manifest "$tmpdir/runtime"

  tar -czf "$output" -C "$tmpdir" runtime
  rm -rf "$tmpdir"
  echo "✅ Snapshot creado: $output"
  write_archive_checksum "$output"

  if [ -n "$keep_after_backup" ]; then
    echo "ℹ️ Auto-prune tras backup (keep=$keep_after_backup)"
    prune_snapshots "$keep_after_backup"
  fi
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

  validate_keep_value "$keep"

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
    rm -f "${file}.sha256"
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

verify_snapshot_path() {
  local snapshot="$1"
  if [ ! -f "$snapshot" ]; then
    echo "❌ Snapshot no encontrado: $snapshot"
    return 1
  fi

  verify_archive_checksum "$snapshot"

  local tmpdir
  tmpdir="$(mktemp -d /tmp/stack-hub-verify-XXXX)"

  if ! tar -tzf "$snapshot" >/dev/null 2>&1; then
    rm -rf "$tmpdir"
    echo "❌ Snapshot corrupto o ilegible: $snapshot"
    return 1
  fi

  tar -xzf "$snapshot" -C "$tmpdir"
  if [ ! -d "$tmpdir/runtime" ]; then
    rm -rf "$tmpdir"
    echo "❌ Snapshot inválido: no contiene carpeta runtime/"
    return 1
  fi

  if [ ! -f "$tmpdir/runtime/snapshot-meta.json" ]; then
    echo "⚠️  Snapshot sin snapshot-meta.json"
  else
    echo "✅ Meta presente: snapshot-meta.json"
  fi

  verify_runtime_files_manifest "$tmpdir/runtime"
  rm -rf "$tmpdir"
  echo "✅ Snapshot verificado: $snapshot"
}

verify_snapshot_ref() {
  local ref="$1"
  local snapshot
  snapshot="$(resolve_snapshot_path "$ref" || true)"
  if [ -z "$snapshot" ] || [ ! -f "$snapshot" ]; then
    echo "❌ Snapshot no encontrado: $ref"
    return 1
  fi
  verify_snapshot_path "$snapshot"
}

restore_runtime() {
  local ref="$1"
  local snapshot
  snapshot="$(resolve_snapshot_path "$ref" || true)"
  if [ -z "$snapshot" ] || [ ! -f "$snapshot" ]; then
    echo "❌ Snapshot no encontrado: $ref"
    exit 1
  fi

  echo "🔎 Verificando snapshot antes de restaurar..."
  verify_snapshot_path "$snapshot"

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
      local keep=""
      while [ $# -gt 0 ]; do
        case "$1" in
          --name)
            if [ -z "${2:-}" ]; then
              echo "❌ Falta valor para --name"
              exit 1
            fi
            name="$2"
            shift 2
            ;;
          --keep)
            if [ -z "${2:-}" ]; then
              echo "❌ Falta valor para --keep"
              exit 1
            fi
            keep="$2"
            shift 2
            ;;
          --*)
            echo "❌ Opción no soportada para backup: $1"
            exit 1
            ;;
          *)
            if [ -z "$name" ]; then
              name="$1"
              shift
            else
              echo "❌ Argumento inesperado para backup: $1"
              exit 1
            fi
            ;;
        esac
      done
      backup_runtime "$name" "$keep"
      ;;
    list)
      shift
      if [ $# -gt 0 ]; then
        echo "❌ Argumentos no soportados para list: $*"
        exit 1
      fi
      list_snapshots
      ;;
    verify)
      shift
      if [ -z "${1:-}" ]; then
        echo "❌ Debes indicar snapshot a verificar (o latest)."
        exit 1
      fi
      local verify_ref="$1"
      shift
      if [ $# -gt 0 ]; then
        echo "❌ Argumentos no soportados para verify: $*"
        exit 1
      fi
      verify_snapshot_ref "$verify_ref"
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
