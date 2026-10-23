FROM node:22.23.4-alpine as dependencies
WORKDIR /app
COPY . ./
RUN npm i
RUN npm install pg --save 
EXPOSE 3000
CMD ["npm", "start"]
