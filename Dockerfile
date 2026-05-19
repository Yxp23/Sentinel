FROM python:3.11-slim

# Install Node.js
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Install jaclang
RUN pip install jaclang openai

# Set working directory
WORKDIR /app

# Copy the entire project
COPY . /app

# Build the frontend
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Expose the server port
EXPOSE 3002

# Run the Express server
CMD ["node", "server.js"]
