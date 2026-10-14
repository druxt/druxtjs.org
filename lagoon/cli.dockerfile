FROM uselagoon/php-8.3-cli-drupal:26.8.1

# drupal/ is the composer project. The vendored patches must be present
# before the install applies them.
COPY drupal/composer.json drupal/composer.lock drupal/patches.lock.json /app/drupal/
COPY drupal/patches /app/drupal/patches
RUN composer install --working-dir=/app/drupal --no-dev --no-interaction --no-progress
# Before the code is copied, so a code change keeps this layer. Vale, the prose linter the vale module runs against text fields: the same
# pinned binary and ai-tells rules the pipeline lints markdown with, so content
# and markdown answer to one ruleset. install-vale.sh verifies both checksums.
# Vale's release build links against glibc, which Alpine lacks; gcompat supplies the loader.
RUN apk add --no-cache gcompat
COPY .gitlab/scripts/install-vale.sh /app/.gitlab/scripts/install-vale.sh
COPY .vale.ini /app/.vale.ini
RUN bash /app/.gitlab/scripts/install-vale.sh /app/.vale/bin /app/.vale/styles

COPY drupal /app/drupal
COPY lagoon /app/lagoon

# settings.php is core's default, then the Lagoon settings.
RUN cp /app/drupal/web/sites/default/default.settings.php /app/drupal/web/sites/default/settings.php \
  && printf '\n%s\n' 'include $app_root . "/" . $site_path . "/settings.lagoon.php";' >> /app/drupal/web/sites/default/settings.php \
  && mkdir -p /app/drupal/web/sites/default/files

ENV WEBROOT=drupal/web
ENV PATH=/app/drupal/vendor/bin:$PATH
