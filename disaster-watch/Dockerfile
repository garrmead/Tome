FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
COPY lib ./lib
COPY public ./public
ENV PORT=4310
EXPOSE 4310
CMD ["node", "server.mjs"]
