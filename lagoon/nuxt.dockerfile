# The generated half of the documentation: docgen over druxt.js at `docgenRef`,
# the packages the site installs.
FROM amazeeio/node:16-builder@sha256:4dd9a540c732a011258fec4ef1465bda8641c91c77939ca9e494c53a2ff7ef1c AS api
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CYPRESS_INSTALL_BINARY=0 HUSKY=0
COPY docs-source.json /tmp/docs-source.json
COPY scripts/snapshot-changelog.sh /tmp/snapshot-changelog.sh
# A development snapshot's release notes need druxt.js's history, which a
# blobless fetch carries and a shallow one does not.
RUN snapshot="$(node -p "require('/tmp/docs-source.json').snapshot || ''")" \
  && depth="--depth 1" && if [ -n "$snapshot" ]; then depth="--filter=blob:none"; fi \
  && git init -q /src \
  && git -C /src fetch -q $depth "$(node -p "require('/tmp/docs-source.json').repository")" "$(node -p "const p = require('/tmp/docs-source.json'); p.docgenRef || p.ref")" \
  && git -C /src checkout -q FETCH_HEAD
WORKDIR /src
RUN corepack enable && yarn install --immutable && yarn build \
  && snapshot="$(node -p "require('/tmp/docs-source.json').snapshot || ''")" \
  && if [ -n "$snapshot" ]; then sh /tmp/snapshot-changelog.sh /src "$snapshot"; fi \
  && node packages/docgen/bin/druxt-docgen.js --destination /generated

# The authored markdown the generated pages sit beside, at `ref`. druxt.js no
# longer carries it, so it stays at the last commit that did.
FROM amazeeio/node:16-builder@sha256:4dd9a540c732a011258fec4ef1465bda8641c91c77939ca9e494c53a2ff7ef1c AS docs
COPY docs-source.json /tmp/docs-source.json
RUN git init -q /src \
  && git -C /src fetch -q --depth 1 "$(node -p "require('/tmp/docs-source.json').repository")" "$(node -p "require('/tmp/docs-source.json').ref")" \
  && git -C /src checkout -q FETCH_HEAD

# The app and its dependencies. It builds when it starts, once Drupal answers.
FROM amazeeio/node:16-builder@sha256:4dd9a540c732a011258fec4ef1465bda8641c91c77939ca9e494c53a2ff7ef1c AS app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COPY nuxt /app
RUN corepack enable && yarn install --immutable
COPY --from=docs /src/docs/nuxt/content /app/content
COPY --from=api /generated /app/content
RUN fix-permissions /app

FROM amazeeio/node:16@sha256:11f2d4ce2e741dbdc87cf4929e3a30f0d06ece1e137b33073aa291154d067316
COPY --from=app /app /app
ENV HOST=0.0.0.0 PORT=3000 DRUXT_BASE_URL=http://nginx:8080
EXPOSE 3000
CMD ["node", "server/start.js"]
