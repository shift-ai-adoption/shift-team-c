FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache tzdata && npm install --omit=dev
COPY . .
EXPOSE 8090
CMD ["node", "server.js"]
