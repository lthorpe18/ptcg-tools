#!/usr/bin/env python3
import json
import urllib.request

url = 'https://championships.pokemon.com/api/events.json?locale=en-us'
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-GB,en;q=0.9',
})
with urllib.request.urlopen(req, timeout=35) as response:
    data = json.loads(response.read().decode('utf-8'))
items = data.get('items', [])
print('itemsFound=', data.get('itemsFound'), 'version=', data.get('version'), 'count=', len(items))
all_keys = sorted({key for item in items if isinstance(item, dict) for key in item})
print('all_keys=', all_keys)
types = {}
for item in items:
    types[item.get('type_s')] = types.get(item.get('type_s'), 0) + 1
print('types=', types)
for i, item in enumerate(items):
    print(json.dumps({
        'i': i,
        'name': item.get('eventName_s'),
        'type': item.get('type_s'),
        'season': item.get('year_s'),
        'date': item.get('displayDateRange_s'),
        'location': item.get('eventLocation_s'),
        'region': item.get('region_s'),
        'url': item.get('uRL_s'),
        'keys': sorted(item.keys()),
    }, ensure_ascii=False))
