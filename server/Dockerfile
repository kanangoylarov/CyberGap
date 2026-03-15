FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

# Generate Prisma client
RUN npx prisma generate --schema=src/prisma/schema.prisma

EXPOSE 3000

CMD ["node", "src/server.js"]
