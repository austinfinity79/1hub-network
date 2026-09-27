# 1hub.network P0 — app image. Build context is an exact `git archive <sha>`
# of the application, never a working tree.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# pnpm applies patches/ (patchedDependencies) during the install; the frozen
# install fails without it, so it is copied before the install.
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN NODE_ENV=production pnpm build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
