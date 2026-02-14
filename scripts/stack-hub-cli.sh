#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCH_SCRIPT="$SCRIPT_DIR/launch-hub.sh"
STOP_SCRIPT="$SCRIPT_DIR/stop-hub.sh"
STATUS_SCRIPT="$SCRIPT_DIR/hub-status.sh"
DOCTOR_SCRIPT="$SCRIPT_DIR/hub-doctor.sh"
LOGS_SCRIPT="$SCRIPT_DIR/hub-logs.sh"
SELFTEST_SCRIPT="$SCRIPT_DIR/hub-selftest.sh"
SNAPSHOT_SCRIPT="$SCRIPT_DIR/runtime-snapshot.sh"

usage() {
  cat <<'EOF'
Uso:
  stack-hub [curso] [opciones]

Cursos:
  hub | ios | android | sdd

Opciones:
  --course <curso>         Igual que argumento posicional de curso.
  --port <numero>          Fuerza puerto (STACK_MY_ARCH_HUB_PORT).
  --strict                 Auto-rebuild en modo strict.
  --fast                   Auto-rebuild en modo fast (default).
  --force-rebuild          Fuerza rebuild aunque manifest+commits coincidan.
  --skip-auto-rebuild      Desactiva rebuild automático en este arranque.
  --stop                   Detiene el hub.
  --stop-force             Fuerza parada aunque PID/puerto no parezcan del hub.
  --restart                Reinicia el hub y luego abre curso.
  --status                 Estado del hub (PID/puerto/health/manifest).
  --doctor                 Diagnóstico completo de entorno y salud.
  --logs [-f|--follow]     Muestra log del hub (opcional en vivo).
  --selftest               Smoke aislado en puerto temporal.
  --selftest-strict        Selftest con consulta IA real.
  --backup-runtime [name]  Crea snapshot de .runtime.
  --backup-runtime-keep N  Auto-prune tras backup (mantiene N).
  --list-runtime-backups   Lista snapshots disponibles.
  --verify-runtime-backup <ref> Verifica integridad de snapshot.
  --restore-runtime <ref>  Restaura snapshot (archivo o latest).
  --prune-runtime-backups <keep>  Mantiene N snapshots y borra el resto.
  -h, --help               Muestra esta ayuda.

Ejemplos:
  stack-hub
  stack-hub sdd --strict
  stack-hub --course ios --port 46200
  stack-hub --status
  stack-hub --doctor
  stack-hub --logs
  stack-hub --logs --follow
  stack-hub --selftest
  stack-hub --selftest --strict
  stack-hub --backup-runtime
  stack-hub --backup-runtime before-migration
  stack-hub --backup-runtime --backup-runtime-keep 20
  stack-hub --list-runtime-backups
  stack-hub --verify-runtime-backup latest
  stack-hub --restore-runtime latest
  stack-hub --prune-runtime-backups 10
  stack-hub --stop-force
  stack-hub ios --restart
  stack-hub --stop
EOF
}

validate_course() {
  local candidate="$1"
  case "$candidate" in
    hub|ios|android|sdd)
      return 0
      ;;
    *)
      echo "❌ Curso no válido: $candidate"
      echo "Valores permitidos: hub | ios | android | sdd"
      return 1
      ;;
  esac
}

main() {
  local course="hub"
  local mode_set=0
  local restart=0
  local run_selftest=0
  local selftest_strict=0
  local run_backup=0
  local backup_name=""
  local backup_keep=""
  local run_list_backups=0
  local run_verify=0
  local verify_ref=""
  local run_restore=0
  local restore_ref=""
  local run_prune=0
  local prune_keep=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      hub|ios|android|sdd)
        course="$1"
        shift
        ;;
      --course)
        if [[ $# -lt 2 ]]; then
          echo "❌ Falta valor para --course"
          exit 1
        fi
        validate_course "$2"
        course="$2"
        shift 2
        ;;
      --port)
        if [[ $# -lt 2 ]]; then
          echo "❌ Falta valor para --port"
          exit 1
        fi
        if ! [[ "$2" =~ ^[0-9]+$ ]]; then
          echo "❌ Puerto inválido: $2"
          exit 1
        fi
        export STACK_MY_ARCH_HUB_PORT="$2"
        shift 2
        ;;
      --strict)
        export STACK_MY_ARCH_AUTO_REBUILD_MODE="strict"
        mode_set=1
        selftest_strict=1
        shift
        ;;
      --fast)
        export STACK_MY_ARCH_AUTO_REBUILD_MODE="fast"
        mode_set=1
        selftest_strict=0
        shift
        ;;
      --force-rebuild)
        export STACK_MY_ARCH_FORCE_REBUILD=1
        shift
        ;;
      --skip-auto-rebuild)
        export STACK_MY_ARCH_SKIP_AUTO_REBUILD=1
        shift
        ;;
      --stop)
        exec /bin/zsh -f "$STOP_SCRIPT"
        ;;
      --stop-force)
        STACK_MY_ARCH_STOP_FORCE=1 exec /bin/zsh -f "$STOP_SCRIPT"
        ;;
      --restart)
        restart=1
        shift
        ;;
      status|--status)
        exec /bin/zsh -f "$STATUS_SCRIPT"
        ;;
      doctor|--doctor)
        exec /bin/zsh -f "$DOCTOR_SCRIPT"
        ;;
      logs|--logs)
        shift
        if [[ "${1:-}" = "--follow" ]] || [[ "${1:-}" = "-f" ]]; then
          exec /bin/zsh -f "$LOGS_SCRIPT" --follow
        fi
        exec /bin/zsh -f "$LOGS_SCRIPT"
        ;;
      selftest|--selftest)
        run_selftest=1
        shift
        ;;
      --selftest-strict)
        run_selftest=1
        selftest_strict=1
        shift
        ;;
      --backup-runtime)
        run_backup=1
        shift
        if [[ -n "${1:-}" ]] && [[ "${1}" != --* ]]; then
          backup_name="$1"
          shift
        fi
        ;;
      --backup-runtime-keep)
        if [[ -z "${2:-}" ]]; then
          echo "❌ Falta valor para --backup-runtime-keep"
          exit 1
        fi
        run_backup=1
        backup_keep="$2"
        shift 2
        ;;
      --list-runtime-backups)
        run_list_backups=1
        shift
        ;;
      --verify-runtime-backup)
        if [[ -z "${2:-}" ]]; then
          echo "❌ Falta valor para --verify-runtime-backup"
          exit 1
        fi
        run_verify=1
        verify_ref="$2"
        shift 2
        ;;
      --restore-runtime)
        if [[ -z "${2:-}" ]]; then
          echo "❌ Falta valor para --restore-runtime"
          exit 1
        fi
        run_restore=1
        restore_ref="$2"
        shift 2
        ;;
      --prune-runtime-backups)
        if [[ -z "${2:-}" ]]; then
          echo "❌ Falta valor para --prune-runtime-backups"
          exit 1
        fi
        run_prune=1
        prune_keep="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "❌ Opción no reconocida: $1"
        usage
        exit 1
        ;;
    esac
  done

  if [[ "$mode_set" -eq 0 ]] && [[ -z "${STACK_MY_ARCH_AUTO_REBUILD_MODE:-}" ]]; then
    export STACK_MY_ARCH_AUTO_REBUILD_MODE="fast"
  fi

  if [[ "$restart" -eq 1 ]]; then
    /bin/zsh -f "$STOP_SCRIPT" >/dev/null 2>&1 || true
  fi

  if [[ "$run_list_backups" -eq 1 ]]; then
    exec /bin/zsh -f "$SNAPSHOT_SCRIPT" list
  fi

  if [[ "$run_backup" -eq 1 ]]; then
    local backup_args=("backup")
    if [[ -n "$backup_name" ]]; then
      backup_args+=("--name" "$backup_name")
    fi
    if [[ -n "$backup_keep" ]]; then
      backup_args+=("--keep" "$backup_keep")
    fi
    exec /bin/zsh -f "$SNAPSHOT_SCRIPT" "${backup_args[@]}"
  fi

  if [[ "$run_verify" -eq 1 ]]; then
    exec /bin/zsh -f "$SNAPSHOT_SCRIPT" verify "$verify_ref"
  fi

  if [[ "$run_restore" -eq 1 ]]; then
    exec /bin/zsh -f "$SNAPSHOT_SCRIPT" restore "$restore_ref"
  fi

  if [[ "$run_prune" -eq 1 ]]; then
    exec /bin/zsh -f "$SNAPSHOT_SCRIPT" prune "$prune_keep"
  fi

  if [[ "$run_selftest" -eq 1 ]]; then
    if [[ "$selftest_strict" -eq 1 ]]; then
      exec /bin/zsh -f "$SELFTEST_SCRIPT" --strict
    fi
    exec /bin/zsh -f "$SELFTEST_SCRIPT"
  fi

  exec /bin/zsh -f "$LAUNCH_SCRIPT" --course "$course"
}

main "$@"
