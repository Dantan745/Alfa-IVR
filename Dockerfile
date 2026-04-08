FROM node:22-alpine AS build
WORKDIR /app
COPY web/package.json web/package-lock.json* web/
WORKDIR /app/web
RUN npm ci
COPY web/ .
RUN npm run build

WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY server/*.mjs ./
COPY server/ml ./ml

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/data
RUN mkdir -p /data
COPY --from=build /app/server /app/server
COPY --from=build /app/web/dist /app/web/dist
EXPOSE 8080
CMD ["node", "server/index.mjs"]
