import os
import re
from http import HTTPStatus
import urllib.request
from urllib.parse import urlparse

ALLOWED_HOSTS = [
    r'tiktokcdn-\.com$',
    r'twimg\.com$',
    r'ytimg\.com$',
    r'googlevideo\.com$',
    r'facebook\.com$',
    r'fbcdn\.net$',
    r'instagram\.com$',
    r'cdninstagram\.com$',
    r'spotify\.com$',
    r'scdn\.com$',
    r'pinterest\.com$',
    r'pinimg\.com$',
    r'redditmedia\.com$',
    r'redd\.it$',
    r'reddituploads\.com$',
]

def _allowed(host: str) -> bool:
    for pat in ALLOWED_HOSTS:
        if re.search(pat, host, re.IGNORECASE):
            return True
    return False

def handler(request):
    query = request.get('query', {})
    raw = query.get('url', [''])[0] if isinstance(query.get('url'), list) else query.get('url', '')
    name = query.get('name', ['video.mp4'])[0] if isinstance(query.get('name'), list) else query.get('name', 'video.mp4')
    if not raw:
        return {
            'statusCode': HTTPStatus.BAD_REQUEST,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing ?url='})
        }
    try:
        parsed = urlparse(raw)
        host = parsed.hostname or ''
    except Exception:
        return {
            'statusCode': HTTPStatus.BAD_REQUEST,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid URL'})
        }
    if not _allowed(host):
        return {
            'statusCode': HTTPStatus.FORBIDDEN,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Host not allowed'})
        }

    def generate():
        try:
            with urllib.request.urlopen(raw, timeout=30) as resp:
                # read in chunks to avoid loading whole file into memory
                while True:
                    chunk = resp.read(8192)
                    if not chunk:
                        break
                    yield chunk
        except Exception:
            # If any error, yield nothing (client will see empty)
            return

    # Vercel expects body as string or bytes? According to docs, can return iterable.
    # We'll return a StreamingResponse via returning a generator in 'body'.
    return {
        'statusCode': HTTPStatus.OK,
        'headers': {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': f'attachment; filename="{name}"',
            'Access-Control-Allow-Origin': '*',
        },
        'body': generate()
    }

import json