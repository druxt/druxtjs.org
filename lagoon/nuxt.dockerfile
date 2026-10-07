# The generated half of the documentation: docgen over the pinned druxt.js.
FROM amazeeio/node:16-builder@sha256:4dd9a540c732a011258fec4ef1465bda8641c91c77939ca9e494c53a2ff7ef1c AS docs
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CYPRESS_INSTALL_BINARY=0 HUSKY=0
COPY docs-source.json /tmp/docs-source.json
RUN git init -q /src \
  && git -C /src fetch -q --depth 1 "$(node -p "require('/tmp/docs-source.json').repository")" "$(node -p "require('/tmp/docs-source.json').ref")" \
  && git -C /src checkout -q FETCH_HEAD
WORKDIR /src
RUN corepack enable && yarn install --immutable && yarn build && yarn build:docs

# Only what the install reads, so a code change reuses the installed
# dependencies. storybook.dockerfile repeats these stages to share them.
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

# Dependencies first, as a layer of their own that a code change leaves as it
# was. Owned by Lagoon's runtime user, so the build at start can write to /app.
FROM amazeeio/node:16@sha256:11f2d4ce2e741dbdc87cf4929e3a30f0d06ece1e137b33073aa291154d067316
COPY --from=deps --chown=10000:0 /app /app
COPY --chown=10000:0 nuxt /app
COPY --from=docs --chown=10000:0 /src/docs/nuxt/content /app/content
ENV HOST=0.0.0.0 PORT=3000 DRUXT_BASE_URL=http://nginx:8080
EXPOSE 3000
CMD ["node", "server/start.js"]
