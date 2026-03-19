FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --omit=dev

# Bundle app source
COPY . .

# Run the bot
CMD [ "npm", "start" ]
