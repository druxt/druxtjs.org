# Storybook for the site's components and Druxt's, beside the app. It starts
# once Drupal answers, since Druxt writes its stories from the backend's
# displays, menus and views.
FROM amazeeio/node:16-builder@sha256:4dd9a540c732a011258fec4ef1465bda8641c91c77939ca9e494c53a2ff7ef1c AS app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COPY nuxt /app
RUN corepack enable && yarn install --immutable && mkdir -p /app/content
RUN fix-permissions /app

FROM amazeeio/node:16@sha256:11f2d4ce2e741dbdc87cf4929e3a30f0d06ece1e137b33073aa291154d067316
COPY --from=app /app /app
ENV HOST=0.0.0.0 PORT=3000 DRUXT_BASE_URL=http://nginx:8080
EXPOSE 3000
CMD ["node", "server/storybook.js"]
