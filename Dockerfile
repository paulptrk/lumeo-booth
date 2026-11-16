FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# dependencies first so this layer is cached until package files change.
# NODE_ENV=production already makes npm ci skip the dev dependencies
COPY package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node seeds ./seeds
COPY --chown=node:node openapi.yaml ./

# never run as root
USER node

EXPOSE 3000

# apply any new migrations, then start the server. exec so the server gets
# docker's stop signal directly. DATABASE_URL comes from the environment
CMD ["sh", "-c", "node scripts/migrate.js && exec node src/server.js"]
