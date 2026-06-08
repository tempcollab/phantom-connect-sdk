# Dockerfile — Phantom Connect SDK Security Audit
#
# Base image pinned by digest for reproducibility.
# Runtime: node v24.x, yarn 4.2.2 via corepack.
# Git commit pinned at audit time: 33efbe59a34a0de25d1bd38f3e91758a802a3f5f

FROM node@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63

# Install openssl (needed for S1 HTTPS capture server) and git
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up corepack and yarn
RUN corepack enable && corepack prepare yarn@4.2.2 --activate

WORKDIR /app

# Copy the repository
COPY . .

# Install workspace dependencies for the audit targets
RUN yarn workspaces focus @phantom/cli @phantom/embedded-provider-core

# Default: run all exploit PoCs
CMD ["bash", "autofyn_audit/run_exploits.sh"]
