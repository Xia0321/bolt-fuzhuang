FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs scrape.mjs translate.mjs saleor.mjs ./
COPY public ./public
ENV NODE_ENV=production DATA_DIR=/data
EXPOSE 8200
CMD ["node", "server.mjs"]
