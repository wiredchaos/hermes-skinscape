FROM ghcr.io/home-assistant/base:latest

ARG BUILD_VERSION="0.2.0"
ARG BUILD_ARCH="unknown"

LABEL \
  io.hass.version="${BUILD_VERSION}" \
  io.hass.type="app" \
  io.hass.arch="${BUILD_ARCH}" \
  org.opencontainers.image.title="Hermes Skinscape Bridge" \
  org.opencontainers.image.description="Publish animated ASCII media inside Home Assistant" \
  org.opencontainers.image.source="https://github.com/wiredchaos/hermes-skinscape"

RUN apk add --no-cache python3
COPY run.sh /run.sh
COPY server.py /app/server.py
COPY www /app/www
RUN chmod a+x /run.sh
EXPOSE 8099
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -q -O - http://127.0.0.1:8099/health >/dev/null || exit 1
CMD ["/run.sh"]
