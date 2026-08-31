#!/usr/bin/env python3
import html
import json
import re
import urllib.request

headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-GB,en;q=0.9',
}

for label, url in [
    ('rk9', 'https://rk9.gg/events/pokemon'),
    ('championships', 'https://championships.pokemon.com/en-us/events?status=upcoming'),
    ('pokemon-events-api', 'https://championships.pokemon.com/api/events.json?locale=en-us'),
]:
    print('\n###', label, url)
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=35) as response:
        raw = response.read().decode('utf-8', errors='replace')
        print('status=', response.status)
        print('content_type=', response.headers.get('Content-Type'))
        print('length=', len(raw))
        if label == 'pokemon-events-api':
            data = json.loads(raw)
            print('root_type=', type(data).__name__)
            if isinstance(data, dict):
                print('root_keys=', list(data.keys())[:30])
                for key, value in data.items():
                    if isinstance(value, list):
                        print('list_key=', key, 'count=', len(value))
                        if value:
                            print('sample_item=', json.dumps(value[0], ensure_ascii=False)[:5000])
                            break
            elif isinstance(data, list):
                print('count=', len(data))
                if data:
                    print('sample_item=', json.dumps(data[0], ensure_ascii=False)[:5000])
            continue
        body = html.unescape(raw)
        title = re.search(r'<title[^>]*>(.*?)</title>', body, re.I | re.S)
        print('title=', re.sub(r'\s+', ' ', title.group(1)).strip() if title else None)
        for needle in ['Regional Championships', 'International Championships', 'Special Championships', 'World Championships', 'dataURL_s']:
            pos = body.lower().find(needle.lower())
            print(f'{needle}_pos=', pos)
            if pos >= 0:
                print(f'{needle}_snippet=', re.sub(r'\s+', ' ', body[max(0,pos-250):pos+800]))
