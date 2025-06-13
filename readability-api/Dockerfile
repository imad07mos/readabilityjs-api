# Use a Node.js official image as the base
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
# We copy these first to leverage Docker's layer caching
COPY package*.json ./

# Install dependencies (will now include dompurify)
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables (can be overridden during docker run/compose)
ENV PORT=3000

# Command to run the application
CMD ["npm", "start"]