FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
# Claude Code：配置 CLAUDE_CODE_OAUTH_TOKEN 时用它翻译（订阅额度）
RUN npm install -g @anthropic-ai/claude-code@2.1.283 --no-audit --no-fund
COPY server.mjs scrape.mjs translate.mjs saleor.mjs ./
COPY public ./public
ENV NODE_ENV=production DATA_DIR=/data
EXPOSE 8200
CMD ["node", "server.mjs"]
