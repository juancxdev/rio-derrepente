FROM migrate/migrate:v4.18.3

# Empaquetar las migraciones dentro de la imagen evita depender de un bind mount
# del checkout de Coolify, que puede crear el directorio pero no copiar sus SQL.
COPY migrations /migrations
COPY run-migrations.sh /run-migrations.sh
RUN chmod +x /run-migrations.sh

ENTRYPOINT ["/run-migrations.sh"]
