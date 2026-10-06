FROM python:3.12-slim-bookworm

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY pyproject.toml ./
COPY app ./app

RUN uv sync --no-dev --no-install-project

# Non-root
RUN useradd --create-home --shell /bin/bash scheduler && chown -R scheduler:scheduler /app
USER scheduler

EXPOSE 8500

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD wget -O- http://localhost:8500/health || exit 1

CMD ["uv", "run", "--no-dev", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8500"]
