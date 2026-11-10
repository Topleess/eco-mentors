FROM node:22.22.1-alpine3.23
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && mkdir /data && chown node:node /data
COPY server.cjs ./
USER node
CMD ["node", "server.cjs"]
