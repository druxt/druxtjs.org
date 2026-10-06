# Storybook for the site's components and Druxt's, beside the app. It starts
# once Drupal answers, since Druxt writes its stories from the backend's
# displays, menus and views.

# The same stages as nuxt.dockerfile, so this image reuses its install.
FROM amazeeio/node:16-builder@sha256:4dd9a540c732a011258fec4ef1465bda8641c91c77939ca9e494c53a2ff7ef1c AS manifests
COPY nuxt /nuxt
RUN mkdir /manifests && cd /nuxt \
  && cp package.json yarn.lock .yarnrc.yml /manifests/ \
  && for dir in .yarn/patches .yarn/plugins .yarn/releases patches vendor; do \
    if [ -d "$dir" ]; then mkdir -p "/manifests/$(dirname "$dir")" && cp -R "$dir" "/manifests/$dir"; fi; \
  done

FROM amazeeio/node:16-builder@sha256:4dd9a540c732a011258fec4ef1465bda8641c91c77939ca9e494c53a2ff7ef1c AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COPY --from=manifests /manifests /app
RUN corepack enable && yarn install --immutable

FROM deps AS app
COPY nuxt /app
RUN mkdir -p /app/content

# Owned by Lagoon's runtime user, as in nuxt.dockerfile.
FROM amazeeio/node:16@sha256:11f2d4ce2e741dbdc87cf4929e3a30f0d06ece1e137b33073aa291154d067316
COPY --from=app --chown=10000:0 /app /app
ENV HOST=0.0.0.0 PORT=3000 DRUXT_BASE_URL=http://nginx:8080
EXPOSE 3000
CMD ["node", "server/storybook.js"]
