# Use a base image that has Node.js
FROM node:20-bullseye

# Install Python 3
RUN apt-get update && \
    apt-get install -y python3 && \
    rm -rf /var/lib/apt/lists/*

# Install `uv`
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set up a new user named "user" with user ID 1000 (Required by Hugging Face)
RUN useradd -m -u 1000 user

# Set environment variables
ENV UV_PROJECT_ENVIRONMENT="/app/.venv"
ENV PATH="/app/.venv/bin:$PATH"
ENV QT_NOTEBOOK_PYTHON="/app/.venv/bin/python"

# Set up the working directory and assign ownership to the new user
WORKDIR /app
RUN chown -R user:user /app

# Switch to the non-root user
USER user

# 1. Copy ONLY dependency files first
COPY --chown=user:user package.json yarn.lock .yarnrc.yml ./
COPY --chown=user:user .yarn/ .yarn/
COPY --chown=user:user frontend/package.json frontend/
COPY --chown=user:user pyproject.toml uv.lock .python-version ./

# 2. Install Node dependencies
RUN yarn install --immutable

# 3. Install Python dependencies using uv
RUN uv sync --frozen --no-dev --no-install-project

# 4. Copy the rest of the application code
COPY --chown=user:user . .

# 5. Sync uv again to link the project files
RUN uv sync --frozen --no-dev

# 6. Build the Next.js frontend
WORKDIR /app/frontend
RUN yarn build

# Start the Next.js application
CMD ["yarn", "start"]
