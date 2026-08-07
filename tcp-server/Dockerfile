FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js .

EXPOSE 20000

CMD ["node", "server.js"]
