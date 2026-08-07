FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js .

EXPOSE 20000

CMD ["node", "server.js"]
