#!/usr/bin/env bash
# Sourced by ~/.bashrc inside the dev container. post-create.sh installs the
# line that sources it.

# Fall back to the image's UTF-8 locale when the host forwards one this image
# has not generated. Every forwarded value is checked, not only LANG.
available="$(locale -a 2>/dev/null)"
for forwarded in "${LANG:-}" "${LC_ALL:-}" "${LC_ADDRESS:-}" "${LC_COLLATE:-}" \
  "${LC_CTYPE:-}" "${LC_IDENTIFICATION:-}" "${LC_MEASUREMENT:-}" "${LC_MESSAGES:-}" \
  "${LC_MONETARY:-}" "${LC_NAME:-}" "${LC_NUMERIC:-}" "${LC_PAPER:-}" \
  "${LC_TELEPHONE:-}" "${LC_TIME:-}"; do
  case "$forwarded" in '' | C | C.* | POSIX) continue ;; esac
  if ! printf '%s\n' "$available" | grep -qix "$(printf '%s' "$forwarded" | sed 's/UTF-8$/utf8/')"; then
    export LANG=C.UTF-8
    unset LC_ALL LC_ADDRESS LC_COLLATE LC_CTYPE LC_IDENTIFICATION \
      LC_MEASUREMENT LC_MESSAGES LC_MONETARY LC_NAME LC_NUMERIC LC_PAPER \
      LC_TELEPHONE LC_TIME
    break
  fi
done
unset available forwarded

# The rest is for a person at a prompt.
case $- in *i*) ;; *) return 0 2>/dev/null || exit 0 ;; esac

backend="not started"
if [ -f "${WORKSPACE_ROOT:-$PWD}/.env" ]; then
  backend="$(sed -n 's/^BASE_URL=//p' "${WORKSPACE_ROOT:-$PWD}/.env" | head -1)"
  backend="${backend:-not started}"
fi

cat <<EOF

druxtjs.org
  Backend:  ${backend}
  Frontend: http://localhost:3000 once \`npm run dev\` is running

  npm run setup           Assemble, provision, import and start the backend
  npm run dev             Nuxt dev server against the backend
  npm run login           One-time login link for Drupal
  npm run docs:generate   Build the Modules, API and Components pages
  npm run info            Backend details and versions
  npm run stop            Stop the backend

EOF
