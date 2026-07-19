# Use official Apify Playwright Node image
FROM apify/actor-node-playwright-chrome:20

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies لتصغير حجم الصورة
RUN npm prune --omit=dev

# Start Actor
CMD ["npm", "start"]