ARG CLI_IMAGE
FROM ${CLI_IMAGE} AS cli

FROM uselagoon/nginx-drupal:26.10.0
COPY --from=cli /app/drupal /app/drupal
ENV WEBROOT=drupal/web
