#!/usr/bin/env python3
"""Prepara un tenant, sitio y usuario para las pruebas de carga.

El script es idempotente: reutiliza el tenant y el sitio si ya existen, y
actualiza la contraseña del usuario de pruebas. También siembra una predicción
para hoy y otra para mañana usando el endpoint interno del servicio ML.

Las credenciales se guardan en .env.loadtest (modo 600, ignorado por Git) y
las consume scripts/load-test.sh.
"""

import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOAD_ENV = ROOT / ".env.loadtest"
LIMA = timezone(timedelta(hours=-5))


class HttpError(RuntimeError):
    def __init__(self, method, url, status, body):
        self.method = method
        self.url = url
        self.status = status
        self.body = body
        super().__init__(f"{method} {url} -> HTTP {status}: {body}")


def env(name, default=None):
    value = os.environ.get(name)
    return value if value not in (None, "") else default


def read_env_file(path):
    values = {}
    if not path.exists():
        return values
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value
    return values


def request(method, url, body=None, token=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
        raise HttpError(method, url, err.code, parsed) from err
    except urllib.error.URLError as err:
        raise SystemExit(f"No se pudo conectar con {url}: {err.reason}") from err


def superadmin_password():
    password = env("SUPERADMIN_PASSWORD")
    if password:
        return password
    password_file = Path(
        env("SUPERADMIN_PASSWORD_FILE", str(ROOT / ".local" / "superadmin-password.txt"))
    )
    if password_file.exists():
        value = password_file.read_text().strip()
        if value:
            return value
    raise SystemExit(
        "Falta la contraseña del super administrador. Define SUPERADMIN_PASSWORD "
        "o SUPERADMIN_PASSWORD_FILE."
    )


def find_or_create_tenant(api, token, name):
    tenants = request("GET", f"{api}/api/v1/admin/tenants", token=token)
    for tenant in tenants:
        if tenant.get("name", "").casefold() == name.casefold():
            return tenant, False
    tenant = request(
        "POST",
        f"{api}/api/v1/admin/tenants",
        body={"name": name},
        token=token,
    )
    return tenant, True


def find_or_create_site(api, token, tenant_id, code, name, latitude, longitude, tz):
    sites = request("GET", f"{api}/api/v1/admin/tenants/{tenant_id}/sites", token=token)
    for site in sites:
        if site.get("code") == code:
            return site, False
    site = request(
        "POST",
        f"{api}/api/v1/admin/tenants/{tenant_id}/sites",
        body={
            "code": code,
            "name": name,
            "latitude": latitude,
            "longitude": longitude,
            "timezone": tz,
        },
        token=token,
    )
    return site, True


def resolve_fixture_ids(api, token, tenant_id, site_id):
    if not tenant_id or not site_id:
        return None
    sites = request("GET", f"{api}/api/v1/admin/tenants/{tenant_id}/sites", token=token)
    if not any(site.get("id") == site_id for site in sites):
        raise SystemExit(
            f"El sitio {site_id} no existe en el tenant {tenant_id} o no es accesible."
        )
    return tenant_id, site_id


def seed_prediction(ml, tenant_id, site_id, target, token=None):
    request(
        "POST",
        f"{ml}/internal/predictions",
        body={
            "tenant_id": tenant_id,
            "site_id": site_id,
            "prediction_date": target.isoformat(),
        },
        token=token,
        timeout=45,
    )


def main():
    api = env("API_BASE_URL", "http://127.0.0.1:12001").rstrip("/")
    ml = env("ML_BASE_URL", "http://127.0.0.1:12002").rstrip("/")
    super_email = env("SUPERADMIN_EMAIL", "superadmin@example.com")
    tenant_name = env("TEST_TENANT_NAME", "Pruebas de carga")
    site_code = env("TEST_SITE_CODE", "loadtest")
    site_name = env("TEST_SITE_NAME", "Destino de pruebas")
    site_lat = float(env("TEST_SITE_LATITUDE", "-9.295"))
    site_lon = float(env("TEST_SITE_LONGITUDE", "-75.996"))
    site_tz = env("TEST_SITE_TIMEZONE", "America/Lima")
    existing = read_env_file(LOAD_ENV)
    test_email = env("TEST_EMAIL") or existing.get("TEST_EMAIL") or "loadtest@example.com"
    password = env("TEST_PASSWORD") or existing.get("TEST_PASSWORD") or secrets.token_urlsafe(18)

    session = request(
        "POST",
        f"{api}/api/v1/auth/login",
        body={"email": super_email, "password": superadmin_password()},
    )
    token = session.get("access_token")
    if not token:
        raise SystemExit("El login del super administrador no devolvió access_token.")

    tenant_id = env("TEST_TENANT_ID") or existing.get("TEST_TENANT_ID")
    site_id = env("TEST_SITE_ID") or existing.get("TEST_SITE_ID")
    if bool(tenant_id) != bool(site_id):
        raise SystemExit("Define TEST_TENANT_ID y TEST_SITE_ID juntos, o ninguno de los dos.")
    explicit_ids = resolve_fixture_ids(api, token, tenant_id, site_id)

    if explicit_ids:
        tenant_id, site_id = explicit_ids
        tenant_name = f"tenant {tenant_id}"
        site_code = site_id
        print(f"Usando tenant y sitio existentes: {tenant_id} / {site_id}")
    else:
        tenant, created_tenant = find_or_create_tenant(api, token, tenant_name)
        tenant_id = tenant["id"]
        site, created_site = find_or_create_site(
            api,
            token,
            tenant_id,
            site_code,
            site_name,
            site_lat,
            site_lon,
            site_tz,
        )
        site_id = site["id"]
        print(f"Tenant: {tenant_id} ({'creado' if created_tenant else 'existente'})")
        print(f"Sitio:  {site_id} ({'creado' if created_site else 'existente'})")

    request(
        "POST",
        f"{api}/api/v1/admin/users",
        body={
            "email": test_email,
            "display_name": "Usuario de pruebas de carga",
            "password": password,
            "tenant_id": tenant_id,
            "role": "operator",
        },
        token=token,
    )
    print(f"Usuario de pruebas: {test_email}")

    prediction_date = env("PREDICTION_DATE")
    if prediction_date:
        prediction_date = datetime.strptime(prediction_date, "%Y-%m-%d").date()
    else:
        prediction_date = datetime.now(LIMA).date()

    seed = env("SEED_PREDICTIONS", "true").lower() not in ("0", "false", "no")
    if seed:
        for target in sorted({prediction_date, datetime.now(LIMA).date(), datetime.now(LIMA).date() + timedelta(days=1)}):
            try:
                seed_prediction(ml, tenant_id, site_id, target)
                print(f"Predicción sembrada para {target.isoformat()}")
            except HttpError as err:
                print(
                    f"Aviso: no se pudo sembrar la predicción para {target.isoformat()}: {err}",
                    file=sys.stderr,
                )
            except SystemExit as err:
                print(f"Aviso: {err}", file=sys.stderr)
                break
    else:
        print("Seed de predicciones desactivado (SEED_PREDICTIONS=false).")

    target_date = env("TARGET_DATE") or prediction_date.isoformat()
    lines = [
        "# Generado por scripts/loadtest-setup.py. No subir a Git.",
        f"TEST_EMAIL={test_email}",
        f"TEST_PASSWORD={password}",
        f"TEST_TENANT_ID={tenant_id}",
        f"TEST_SITE_ID={site_id}",
        f"PREDICTION_DATE={prediction_date.isoformat()}",
        f"TARGET_DATE={target_date}",
    ]
    LOAD_ENV.write_text("\n".join(lines) + "\n")
    os.chmod(LOAD_ENV, 0o600)

    print()
    print(f"Fixture listo. Credenciales en {LOAD_ENV} (modo 600).")
    print("Siguiente paso:")
    print("  ./scripts/load-test.sh smoke-api.js")
    print("  ./scripts/load-test.sh load-api.js")
    print("  ./scripts/load-test.sh stress-api.js")
    print()
    print("Para incluir el endpoint externo de clima en el smoke:")
    print("  INCLUDE_WEATHER=true ./scripts/load-test.sh smoke-api.js")


if __name__ == "__main__":
    main()
