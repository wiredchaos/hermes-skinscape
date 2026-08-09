FROM ghcr.io/home-assistant/base:latest

RUN apk add --no-cache python3

COPY run.sh /run.sh
COPY server.py /app/server.py
COPY www /app/www
RUN chmod a+x /run.sh

CMD ["/run.sh"]
