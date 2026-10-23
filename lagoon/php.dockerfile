ARG CLI_IMAGE
FROM ${CLI_IMAGE} AS cli

FROM uselagoon/php-8.3-fpm:26.10.0
COPY --from=cli /app/drupal /app/drupal
# A form save runs Vale in this container too, so it needs the same loader.
RUN apk add --no-cache gcompat
COPY --from=cli /app/.vale /app/.vale
COPY --from=cli /app/.vale.ini /app/.vale.ini
