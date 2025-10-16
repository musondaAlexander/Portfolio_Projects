FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY producer.js ./

# Create logs directory and set permissions
RUN mkdir -p logs && chmod 777 logs

# Run as non-root user
USER node

CMD ["node", "producer.js"]
