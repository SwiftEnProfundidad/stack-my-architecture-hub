#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCH_SCRIPT="$SCRIPT_DIR/launch-hub.sh"
STOP_SCRIPT="$SCRIPT_DIR/stop-hub.sh"

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
  -h, --help               Muestra esta ayuda.

Ejemplos:
  stack-hub
  stack-hub sdd --strict
  stack-hub --course ios --port 46200
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
        shift
        ;;
      --fast)
        export STACK_MY_ARCH_AUTO_REBUILD_MODE="fast"
        mode_set=1
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

  exec /bin/zsh -f "$LAUNCH_SCRIPT" --course "$course"
}

main "$@"
