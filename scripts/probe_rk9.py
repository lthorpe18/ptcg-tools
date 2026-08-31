#!/usr/bin/env python3
import html
import re
import urllib.request

sources = [
    ('rk9', 'https://rk9.gg/events/pokemon'),
    ('championships', 'https://championships.pokemon.com/en-us/events?status=upcoming'),
]
headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
}
for label, url in sources:
    print('\n###', label, url)
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=35) as response:
        body = html.unescape(response.read().decode('utf-8', errors='replace'))
        title = re.search(r'<title[^>]*>(.*?)</title>', body, re.I | re.S)
        print('status=', response.status)
        print('final_url=', response.geturl())
        print('content_type=', response.headers.get('Content-Type'))
        print('length=', len(body))
        print('title=', re.sub(r'\s+', ' ', title.group(1)).strip() if title else None)
        for needle in ['Regional Championships', 'International Championships', 'Special Championships', 'World Championships', 'Frankfurt', 'Nice', '__NEXT_DATA__', 'api/', 'events']:
            pos = body.lower().find(needle.lower())
            print(f'{needle}_pos=', pos)
            if pos >= 0:
                print(f'{needle}_snippet=', re.sub(r'\s+', ' ', body[max(0,pos-350):pos+1000]))
