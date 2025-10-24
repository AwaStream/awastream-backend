# Use a secure, lightweight Node.js image
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first
# This uses Docker's build cache effectively
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your app runs on
EXPOSE 5001

# The command to run your application
# Use "npm run dev" if you have nodemon, otherwise use "node server.js"
CMD [ "npm", "run", "dev" ]