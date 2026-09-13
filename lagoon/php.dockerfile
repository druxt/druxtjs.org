ARG CLI_IMAGE
FROM ${CLI_IMAGE} AS cli

FROM uselagoon/php-8.3-fpm:26.8.1
COPY --from=cli /app/drupal /app/drupal
