FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . ./

# Build the application
RUN npm run build

# Set default port (can be overridden via environment variable)
ENV PORT=3001
EXPOSE 3001

# Health check for Docker - checks if service and database are ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "const port = process.env.PORT || 3001; require('http').get('http://127.0.0.1:' + port + '/health/ready', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

CMD ["npm", "run", "start:dev"]
