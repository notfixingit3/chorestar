# Use lightweight Node image
FROM node:20-alpine

WORKDIR /app

# Copy dependency configs
COPY package*.json ./

# Install node dependencies
RUN npm install --omit=dev

# Copy project files
COPY . .

# Expose port 80 inside the container
EXPOSE 80

# Ensure data directory exists
RUN mkdir -p /app/data

# Run Node application
CMD ["npm", "start"]
