FROM node:14-alpine

WORKDIR /app

COPY . ./

RUN npm install --silent --prod

ENV PORT 3000
EXPOSE 3000
ENTRYPOINT [ "node", "./server.js" ]