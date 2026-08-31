#!/usr/bin/env python3
import re
import urllib.request

url = 'https://rk9.gg/events/pokemon'
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
})
with urllib.request.urlopen(req, timeout=35) as response:
    body = response.read().decode('utf-8', errors='replace')
    title = re.search(r'<title[^>]*>(.*?)</title>', body, re.I | re.S)
    print('status=', response.status)
    print('final_url=', response.geturl())
    print('content_type=', response.headers.get('Content-Type'))
    print('length=', len(body))
    print('title=', re.sub(r'\s+', ' ', title.group(1)).strip() if title else None)
    print('has_upcoming=', 'Upcoming Pokémon Events' in body or 'Upcoming Pokemon Events' in body)
    print('has_cloudflare=', 'cloudflare' in body.lower())
    print('has_challenge=', 'challenge' in body.lower())
    print('sample=', re.sub(r'\s+', ' ', body[:1500]))
