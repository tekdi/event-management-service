FROM node:16 as dependencies
WORKDIR /app
COPY . ./
RUN npm i
RUN npm install pg --save 
EXPOSE 3000
CMD ["npm", "start"]
