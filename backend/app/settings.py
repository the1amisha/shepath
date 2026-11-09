"""Environment configuration for local and hosted deployments."""
import os
from urllib.parse import urlsplit


def cors_origins():
    raw = os.environ.get('SHEPATH_CORS_ORIGINS')
    if raw is None:
        return [f'http://{host}:{port}' for host in ('localhost', '127.0.0.1')
                for port in (8080, 8081)]
    origins = list(dict.fromkeys(item.strip() for item in raw.split(',') if item.strip()))
    if not origins:
        raise ValueError('SHEPATH_CORS_ORIGINS must contain explicit HTTP(S) origins')
    for origin in origins:
        url = urlsplit(origin)
        if (url.scheme not in ('http', 'https') or not url.hostname or url.username or
                url.password or url.path or url.query or url.fragment or '*' in origin):
            raise ValueError('SHEPATH_CORS_ORIGINS requires origins without paths or wildcards')
        _ = url.port
    return origins
