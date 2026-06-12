FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# Inline shell avoids entrypoint.sh — the compose bind-mount of ./frontend would
# overlay a script file and Windows CRLF checkouts break exec ./entrypoint.sh.
CMD ["sh", "-c", "npm ci && exec npm run dev -- -H 0.0.0.0"]
