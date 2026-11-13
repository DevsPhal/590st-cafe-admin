FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they must arrive
# as a build arg (setting them under docker-compose's `environment:` is too late) and must be
# a URL the browser can reach — localhost:8080, never a compose service name like api:8080.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL=wss://api.590stcafe.shop/ws
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
# The bot behind the "Log in with Telegram" button (same bot as the customer site). Its domain
# must be set to this dashboard's domain in BotFather (/setdomain) or Telegram refuses the widget.
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=FiveNinetyStCafeBot
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]