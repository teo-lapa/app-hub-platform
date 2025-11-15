# Dockerfile for Jetson Nano OCR Server
# Optimized for NVIDIA Jetson Orin Nano with GPU acceleration

FROM nvcr.io/nvidia/l4t-base:r35.2.1

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # Tesseract OCR
    tesseract-ocr \
    libtesseract-dev \
    # Image processing
    libleptonica-dev \
    libpng-dev \
    libjpeg-dev \
    libtiff-dev \
    zlib1g-dev \
    # PDF processing
    poppler-utils \
    # Node.js 20 LTS
    curl \
    gnupg \
    wget \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    # Download Tesseract language files manually
    && cd /usr/share/tesseract-ocr/4.00/tessdata \
    && wget -q https://github.com/tesseract-ocr/tessdata/raw/main/ita.traineddata \
    && wget -q https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata \
    && wget -q https://github.com/tesseract-ocr/tessdata/raw/main/deu.traineddata \
    && ls -la *.traineddata \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN tesseract --version && node --version && npm --version

# Create directories
RUN mkdir -p /app/storage/uploads \
    /app/storage/processed \
    /app/storage/cache \
    /app/logs

# Copy package files
COPY package.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy application code
COPY server/ ./server/
COPY config/ ./config/

# Environment variables
ENV NODE_ENV=production
ENV PORT=3100
ENV TESSERACT_PATH=/usr/bin/tesseract
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/4.00/tessdata

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3100/api/v1/health || exit 1

# Expose port
EXPOSE 3100

# Start server
CMD ["node", "server/index.js"]
