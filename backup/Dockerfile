FROM postgres:16-alpine

ARG SUPERCRONIC_VERSION=0.2.46
ARG TARGETARCH

RUN apk add --no-cache bash curl \
    && case "${TARGETARCH}" in \
         amd64) SUPERCRONIC_ARCH=amd64 ;; \
         arm64) SUPERCRONIC_ARCH=arm64 ;; \
         *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
       esac \
    && curl -fsSLO "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/supercronic-linux-${SUPERCRONIC_ARCH}" \
    && chmod +x "supercronic-linux-${SUPERCRONIC_ARCH}" \
    && mv "supercronic-linux-${SUPERCRONIC_ARCH}" /usr/local/bin/supercronic

COPY scripts/backup-db.sh /usr/local/bin/backup-db.sh
COPY backup/entrypoint.sh /entrypoint.sh
RUN chmod +x /usr/local/bin/backup-db.sh /entrypoint.sh

ENV CUEBOX_IN_BACKUP_CONTAINER=1
ENV BACKUP_DIR=/backups
ENV PGHOST=postgres

ENTRYPOINT ["/entrypoint.sh"]
