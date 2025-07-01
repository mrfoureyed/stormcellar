# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install timezone data and set timezone
RUN apk add --no-cache tzdata
ENV TZ=America/New_York

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY stormcellar.js ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port for health checks (optional, here if you need it!)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]