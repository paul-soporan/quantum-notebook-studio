# Use a base image that has Node.js (this image already contains a user named 'node' with UID 1000)
FROM node:20-bullseye

# Install Python 3
RUN apt-get update && \
    apt-get install -y python3 && \
    rm -rf /var/lib/apt/lists/*

# Install `uv`
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set environment variables
ENV UV_PROJECT_ENVIRONMENT="/app/.venv"
ENV PATH="/app/.venv/bin:$PATH"
ENV QT_NOTEBOOK_PYTHON="/app/.venv/bin/python"

# Set up the working directory and assign ownership to the existing 'node' user
WORKDIR /app
RUN chown -R node:node /app

# Switch to the built-in non-root user (UID 1000)
USER node

# 1. Copy ONLY dependency files first
COPY --chown=node:node package.json yarn.lock .yarnrc.yml ./
COPY --chown=node:node .yarn/ .yarn/
COPY --chown=node:node frontend/package.json frontend/
COPY --chown=node:node pyproject.toml uv.lock .python-version ./

# 2. Install Node dependencies
RUN yarn install --immutable

# 3. Install Python dependencies using uv
RUN uv sync --frozen --no-dev --no-install-project

# 4. Copy the rest of the application code
COPY --chown=node:node . .

# 5. Sync uv again to link the project files
RUN uv sync --frozen --no-dev

# 6. Build the Next.js frontend
WORKDIR /app/frontend
RUN yarn build

# Start the Next.js application
CMD ["yarn", "start"]
