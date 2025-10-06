FROM node:16-alpine

WORKDIR /usr/app/backend

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3333

CMD ["npm", "start"]