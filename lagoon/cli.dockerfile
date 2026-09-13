FROM uselagoon/php-8.3-cli-drupal:26.8.1

# drupal/ is the composer project; the importer reads the files beside it.
COPY drupal/composer.json drupal/composer.lock drupal/patches.lock.json /app/drupal/
RUN composer install --working-dir=/app/drupal --no-dev --no-interaction --no-progress
COPY drupal /app/drupal
COPY docs-source.json package.json package-lock.json /app/
COPY scripts /app/scripts
COPY lagoon /app/lagoon

# The IR builder needs github-slugger from the root lockfile.
RUN npm ci --prefix /app --ignore-scripts --no-audit --no-fund

# settings.php is core's default, then the Lagoon settings.
RUN cp /app/drupal/web/sites/default/default.settings.php /app/drupal/web/sites/default/settings.php \
  && printf '\n%s\n' 'include $app_root . "/" . $site_path . "/settings.lagoon.php";' >> /app/drupal/web/sites/default/settings.php \
  && mkdir -p /app/drupal/web/sites/default/files

ENV WEBROOT=drupal/web
ENV PATH=/app/drupal/vendor/bin:$PATH
