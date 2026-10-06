FROM uselagoon/php-8.3-cli-drupal:26.8.1

# drupal/ is the composer project. The vendored patches must be present
# before the install applies them.
COPY drupal/composer.json drupal/composer.lock drupal/patches.lock.json /app/drupal/
COPY drupal/patches /app/drupal/patches
RUN composer install --working-dir=/app/drupal --no-dev --no-interaction --no-progress
COPY drupal /app/drupal
COPY lagoon /app/lagoon

# settings.php is core's default, then the Lagoon settings.
RUN cp /app/drupal/web/sites/default/default.settings.php /app/drupal/web/sites/default/settings.php \
  && printf '\n%s\n' 'include $app_root . "/" . $site_path . "/settings.lagoon.php";' >> /app/drupal/web/sites/default/settings.php \
  && mkdir -p /app/drupal/web/sites/default/files

ENV WEBROOT=drupal/web
ENV PATH=/app/drupal/vendor/bin:$PATH
