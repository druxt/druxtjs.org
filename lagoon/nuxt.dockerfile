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
# nuxt.config.js reads the docgen commit from the file beside the nuxt tree.
COPY --chown=10000:0 docs-source.json /docs-source.json
COPY --from=docs --chown=10000:0 /src/docs/nuxt/content /app/content
COPY --from=api --chown=10000:0 /generated /app/content
# The version the badge names: druxt at the commit the API reference is
# generated from, which a snapshot build has stamped with its version.
COPY --from=api --chown=10000:0 /src/packages/druxt/package.json /app/.pinned-druxt.json
ENV HOST=0.0.0.0 PORT=3000 DRUXT_BASE_URL=http://nginx:8080
EXPOSE 3000
CMD ["node", "server/start.js"]
