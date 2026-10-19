#!/usr/bin/env bash
set -Eeuo pipefail

readonly UUID="clipboard-typer@local"
readonly TARGET_DIR="${XDG_DATA_HOME:-${HOME}/.local/share}/gnome-shell/extensions/${UUID}"

if [[ ${EUID} -eq 0 ]]; then
    printf '%s\n' "ОШИБКА: не запускайте удаление от root." >&2
    exit 1
fi

gnome-extensions disable "$UUID" 2>/dev/null || true
if command -v gsettings >/dev/null 2>&1; then
    gsettings reset-recursively org.gnome.shell.extensions.clipboard-typer 2>/dev/null || true
fi
if [[ -d "$TARGET_DIR" && "$(basename -- "$TARGET_DIR")" == "$UUID" ]]; then
    rm -rf -- "$TARGET_DIR"
    printf 'Удалено расширение: %s\n' "$TARGET_DIR"
else
    printf '%s\n' "Расширение не установлено."
fi

printf '%s\n' "История и настройки dconf сброшены; восстановление удалённых данных не предусмотрено."
