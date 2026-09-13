#!/usr/bin/env bash
# Dev container setup, for VS Code, Codespaces and DevPod. The PHP feature
# builds PHP without gd and with sodium disabled. Drupal's installer needs gd,
# and simple_oauth signs tokens with sodium, so both are fixed here.
set -euo pipefail

echo "==> Installing system dependencies"
sudo apt-get update -qq > /dev/null
# python3-setuptools: trixie's Python has no distutils, and the node-gyp that
# Node 16's npm bundles still imports it.
sudo apt-get install -y -qq python3 python3-setuptools build-essential sqlite3 libjpeg-dev libpng-dev libwebp-dev libfreetype-dev zlib1g-dev yamllint > /dev/null

CONF_DIR=$(php --ini | grep 'Scan for additional .ini files' | sed 's/.*: *//')

echo "==> Enabling sodium, and Xdebug on demand only"
echo 'extension=sodium' | sudo tee "$CONF_DIR/sodium.ini" > /dev/null
echo 'xdebug.start_with_request = trigger' | sudo tee "$CONF_DIR/zz-xdebug-trigger.ini" > /dev/null

if ! php -m | grep -qx gd; then
  echo "==> Building gd from PHP's own source tree"
  # gd is a bundled extension, not a PECL package, so it is built from the
  # matching PHP source. mktemp, so the download cannot be swapped under us.
  PHP_FULL_VERSION=$(php -r 'echo PHP_VERSION;')
  PHP_SRC_TMP="$(mktemp -d)"
  trap 'rm -rf "$PHP_SRC_TMP"' EXIT
  mkdir -p "$PHP_SRC_TMP/gd"
  curl -fsSL "https://www.php.net/distributions/php-${PHP_FULL_VERSION}.tar.gz" -o "$PHP_SRC_TMP/php-src.tar.gz"
  tar -xzf "$PHP_SRC_TMP/php-src.tar.gz" -C "$PHP_SRC_TMP/gd" --strip-components=3 "php-${PHP_FULL_VERSION}/ext/gd"
  (
    cd "$PHP_SRC_TMP/gd"
    phpize > /dev/null
    ./configure --with-jpeg --with-webp --with-freetype > /dev/null
    make -j"$(nproc)" > /dev/null
    sudo make install > /dev/null
  )
  echo 'extension=gd' | sudo tee "$CONF_DIR/gd.ini" > /dev/null
fi
php -r "exit(extension_loaded('gd') && extension_loaded('sodium') && extension_loaded('pdo_sqlite') ? 0 : 1);" || { echo "gd, sodium or pdo_sqlite is not loaded" >&2; exit 1; }

echo "==> Trusting this repository's .mise.toml"
mise trust

echo "==> Generating the English locales hosts commonly send over SSH"
sudo apt-get install -y -qq locales > /dev/null
sudo sed -i -E 's/^# (en_(AU|CA|GB|IE|NZ|US)\.UTF-8 UTF-8)/\1/' /etc/locale.gen
sudo locale-gen > /dev/null

echo "==> Installing the shell locale fallback and welcome"
if ! grep -qF '.devcontainer/shell-init.sh' ~/.bashrc; then
  printf '\n# Dev container shell setup: locale fallback and welcome.\nexport WORKSPACE_ROOT=%q\n[ -f "$WORKSPACE_ROOT/.devcontainer/shell-init.sh" ] && . "$WORKSPACE_ROOT/.devcontainer/shell-init.sh"\n' "$PWD" >> ~/.bashrc
fi

echo "==> Enabling corepack, for the frontend's Yarn"
corepack enable 2> /dev/null || sudo env "PATH=$PATH" corepack enable

echo "==> Installing the tooling, then setting up the backend"
npm install --loglevel=error
npm run setup

echo
echo "Ready. Run npm run dev for the frontend, and open a new terminal for the command summary."
