# Use a base image that has Node.js
FROM node:20-bullseye

# Install Python 3
RUN apt-get update && \
    apt-get install -y python3 && \
    rm -rf /var/lib/apt/lists/*

# Install `uv` by copying the compiled binary from the official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set up a working directory
WORKDIR /app

# Ensure uv creates the virtual environment at /app/.venv
# and add it to the system PATH so Python commands use it automatically
ENV UV_PROJECT_ENVIRONMENT="/app/.venv"
ENV PATH="/app/.venv/bin:$PATH"

# 1. Copy ONLY dependency files first to leverage Docker caching
COPY package.json yarn.lock .yarnrc.yml ./
COPY frontend/package.json frontend/
COPY pyproject.toml uv.lock ./

# 2. Install Node dependencies
RUN yarn install --immutable

# 3. Install Python dependencies using uv
# --no-install-project ensures we only download dependencies to cache this layer
# --no-dev skips development dependencies to keep the image small
RUN uv sync --frozen --no-dev --no-install-project

# 4. Copy the rest of the application code
COPY . .

# 5. Sync uv again to link the project files properly
RUN uv sync --frozen --no-dev

# 6. Build the Next.js frontend
WORKDIR /app/frontend
RUN yarn build

# Expose the Next.js default port
EXPOSE 3000

# Ensure the Next.js API knows where the uv virtual environment Python is located
ENV QT_NOTEBOOK_PYTHON="/app/.venv/bin/python"

# Start the Next.js application
CMD ["yarn", "start"]
