FROM postgres:16-alpine

ARG SUPERCRONIC_VERSION=0.2.33

RUN apk add --no-cache bash curl \
    && curl -fsSLO "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
    && chmod +x supercronic-linux-amd64 \
    && mv supercronic-linux-amd64 /usr/local/bin/supercronic

COPY scripts/backup-db.sh /usr/local/bin/backup-db.sh
COPY backup/entrypoint.sh /entrypoint.sh
RUN chmod +x /usr/local/bin/backup-db.sh /entrypoint.sh

ENV CUEBOX_IN_BACKUP_CONTAINER=1
ENV BACKUP_DIR=/backups
ENV PGHOST=postgres

ENTRYPOINT ["/entrypoint.sh"]
