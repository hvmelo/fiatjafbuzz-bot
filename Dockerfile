FROM node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Install websocat and bind-tools (for nslookup)
RUN apk add --no-cache websocat bind-tools

COPY . .

CMD ["node", "bot.js"]