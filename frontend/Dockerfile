FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# Inline shell avoids entrypoint.sh — the compose bind-mount of ./frontend would
# overlay a script file and Windows CRLF checkouts break exec ./entrypoint.sh.
# FRONTEND_MODE selects the run mode per deployed copy (set via .env):
#   production  - `next build` then `next start` (optimized, minified)
#   anything else (default) - `next dev` (hot reload, for active development)
CMD ["sh", "-c", "npm ci && if [ \"$FRONTEND_MODE\" = \"production\" ]; then npm run build && exec npm run start -- -H 0.0.0.0 -p 3000; else exec npm run dev -- -H 0.0.0.0; fi"]
