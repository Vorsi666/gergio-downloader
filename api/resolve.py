import json
import yt_dlp
from http import HTTPStatus
from typing import Any, Dict, List, Optional

def _build_info_dict(url: str) -> Dict[str, Any]:
    ydl_opts = {
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        # Force generic extractor if needed
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info

def _format_label(f: Dict[str, Any]) -> str:
    h = f.get('height') or 0
    res = f'{h}p' if h else ''
    vcodec = f.get('vcodec') or ''
    acodec = f.get('acodec') or ''
    kind = ''
    if vcodec and vcodec != 'none' and acodec and acodec != 'none':
        kind = 'video+audio'
    elif vcodec and vcodec != 'none':
        kind = 'video only'
    elif acodec and acodec != 'none':
        kind = 'audio only'
    bits = [p for p in [res, kind, (f.get('ext') or '').upper()] if p]
    if f.get('fps') and f.get('fps') > 30:
        bits.append(f'{f.get("fps")}fps')
    tbr = f.get('tbr')
    if tbr:
        bits.append(f'{round(tbr)}kbps')
    size = f.get('filesize') or f.get('filesize_approx')
    if size:
        try:
            size_mb = size / (1024 * 1024)
            bits.append(f'{size_mb:.1f}MB')
        except Exception:
            pass
    return ' · '.join(bits) if bits else (f.get('format_id') or '?')

def handler(request):
    # Vercel provides request as dict-like? We'll follow Vercel Python SDK: receives dict with query, method, etc.
    # For simplicity assume query param in request['query'] as dict.
    query = request.get('query', {})
    raw = query.get('url', [''])[0] if isinstance(query.get('url'), list) else query.get('url', '')
    if not raw:
        return {
            'statusCode': HTTPStatus.BAD_REQUEST,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing ?url='})
        }
    try:
        info = _build_info_dict(raw)
    except Exception as e:
        return {
            'statusCode': HTTPStatus.BAD_GATEWAY,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Failed to extract info: {e}'})
        }
    # Build result similar to MediaResult
    title = info.get('title') or ''
    author = info.get('uploader') or info.get('creator') or ''
    thumbnail = info.get('thumbnail')
    # Direct formats
    formats = info.get('formats') or []
    opts: List[Dict[str, Any]] = []
    for f in formats:
        fid = f.get('format_id')
        if not fid or str(fid).startswith('sb'):
            continue
        url = f.get('url')
        if not url:
            continue
        kind_direct = 'direct'
        label = _format_label(f)
        opts.append({
            'label': label,
            'detail': '',
            'kind': kind_direct,
            'url': url
        })
    # Add external link to original post
    opts.append({
        'label': 'Buka halaman asli',
        'detail': 'Tautan post asal',
        'kind': 'external',
        'url': raw
    })
    result = {
        'platform': info.get('extractor') or 'unknown',
        'platformName': info.get('extractor_key') or info.get('extractor') or 'Unknown',
        'sourceUrl': raw,
        'title': title,
        'author': author,
        'thumbnail': thumbnail,
        'embedUrl': None,
        'options': opts,
        'note': ''
    }
    return {
        'statusCode': HTTPStatus.OK,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(result)
    }
