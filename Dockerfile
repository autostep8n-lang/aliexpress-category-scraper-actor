# Use official Apify Playwright Node image with pre-installed browsers
FROM apify/actor-node-playwright-chrome:20

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --quiet --only=prod && npm install --quiet -g typescript

# Copy source files
COPY . .

# Build TypeScript to dist folder
RUN npm run build

# Run the compiled code
CMD ["npm", "start"]
