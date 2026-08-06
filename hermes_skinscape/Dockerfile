ARG BUILD_FROM=python:3.12-alpine
FROM ${BUILD_FROM}

WORKDIR /app
COPY server.py index.html ./
COPY run.sh /run.sh
RUN apk add --no-cache python3 \
    && chmod 0755 /run.sh \
    && mkdir -p /data

EXPOSE 8099
CMD ["/run.sh"]
