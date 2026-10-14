ARG CLI_IMAGE
FROM ${CLI_IMAGE} AS cli

FROM uselagoon/php-8.3-fpm:26.8.1
COPY --from=cli /app/drupal /app/drupal
# A form save runs Vale in this container too.
COPY --from=cli /app/.vale /app/.vale
COPY --from=cli /app/.vale.ini /app/.vale.ini
