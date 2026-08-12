# Use the slim Debian-based Node.js runtime to keep the production image small.
FROM node:24-bookworm-slim

# Cloud Run sends traffic to PORT; production mode disables development behavior.
ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

# Copy dependency manifests first so Docker can cache the dependency layer.
COPY package.json package-lock.json ./
# Install runtime dependencies only and remove npm's download cache.
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code and assign it to the non-root runtime user.
COPY --chown=node:node . .

# Multer writes temporary PDFs here. Persistent files must use Cloud Storage.
RUN mkdir -p public/uploads && chown node:node public/uploads

# Avoid running the web application with root privileges.
USER node

# Document the port expected by Cloud Run and local Docker users.
EXPOSE 8080

# Start the Express HTTP server.
CMD ["node", "./bin/www"]
