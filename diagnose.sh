#!/usr/bin/env bash
set -Eeuo pipefail

readonly UUID="clipboard-typer@local"

check_command() {
    local command_name="$1"
    if command -v "$command_name" >/dev/null 2>&1; then
        printf 'OK   %-24s %s\n' "$command_name" "$(command -v "$command_name")"
    else
        printf 'FAIL %-24s не найдено\n' "$command_name"
    fi
}

printf 'Система: %s\n' "$(sed -n 's/^PRETTY_NAME=//p' /etc/os-release 2>/dev/null | tr -d '"' || true)"
printf 'GNOME:   %s\n' "$(gnome-shell --version 2>/dev/null || printf 'не найден')"
printf 'Сеанс:   %s\n' "${XDG_SESSION_TYPE:-не определён}"
printf 'DISPLAY: %s\n' "${DISPLAY:+задан}"
printf 'Язык:    %s\n' "${LANG:-не задан}"
printf '\nЗависимости (содержимое буфера не читается):\n'
for command_name in gnome-shell gnome-extensions glib-compile-schemas python3 xdotool; do
    check_command "$command_name"
done

printf '\nРасширение:\n'
gnome-extensions info "$UUID" 2>&1 || printf '%s\n' "Не установлено или GNOME Shell ещё не перечитал расширения."

if [[ "${XDG_SESSION_TYPE:-}" != "x11" ]]; then
    printf '\nВНИМАНИЕ: для набора необходимо выбрать «GNOME on Xorg» на экране входа.\n'
elif command -v xdotool >/dev/null 2>&1; then
    if xdotool getactivewindow >/dev/null 2>&1; then
        printf '\nOK: xdotool видит активное X11-окно.\n'
    else
        printf '\nFAIL: xdotool не получил активное окно; проверьте DISPLAY и X11-сеанс.\n'
    fi
fi

printf '\nОшибки расширения можно посмотреть без вывода содержимого истории:\n'
printf '%s\n' "journalctl --user -b --no-pager | grep -F '${UUID}'"

