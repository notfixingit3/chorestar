# Use a lightweight Nginx image to serve static files
FROM nginx:alpine

# Remove default nginx HTML file
RUN rm -rf /usr/share/nginx/html/*

# Copy our static assets to the Nginx HTML directory
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

# Expose port 80 inside the container
EXPOSE 80

# Run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
