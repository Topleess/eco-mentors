#!/usr/bin/env python3
"""Verify real read APIs; --ingest explicitly adds labeled synthetic local traffic."""
import argparse
import json
import os
import time
import urllib.parse
from bootstrap import ROOT, NAME, request

parser = argparse.ArgumentParser()
parser.add_argument('--ingest', action='store_true')
args = parser.parse_args()
config = json.loads((ROOT / 'integration.json').read_text())
for name in ('.env', 'integration.json', 'credentials.json'):
    assert os.stat(ROOT / name).st_mode & 0o777 == 0o600
wid, token = config['websiteId'], config['token']
website = request('/api/websites/' + wid, token=token)
assert website['name'] == NAME and website['domain'] == 'localhost'
if args.ingest:
    # Explicit synthetic test. No private route, referrer, identifier or user-derived data.
    payload = {'website': wid, 'hostname': 'localhost',
               'url': '/analytics-integration-check',
               'title': 'Synthetic local analytics integration check',
               'language': 'en-US', 'screen': '1280x800',
               'userAgent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
               'tag': 'synthetic-local-check'}
    for name in (None, 'synthetic-local-integration-check'):
        body = dict(payload)
        if name:
            body['name'] = name
            body['data'] = {'synthetic': True, 'environment': 'local'}
        result = request('/api/send', {'type': 'event', 'payload': body})
        assert set(result) >= {'cache', 'sessionId', 'visitId'}, 'Ingestion did not save event'
    print('Real ingestion acknowledged: one labeled synthetic pageview + one labeled synthetic event.')
now = int(time.time() * 1000)
query = {'startAt': now - 86400000, 'endAt': now + 60000, 'unit': 'hour', 'timezone': 'UTC'}
responses = {}
for endpoint, extra in [('stats', {}), ('pageviews', {}), ('metrics-path', {'type': 'path'}),
                        ('metrics-event', {'type': 'event'})]:
    path = endpoint.split('-')[0]
    responses[endpoint] = request('/api/websites/' + wid + '/' + path + '?' + urllib.parse.urlencode({**query, **extra}), token=token)
assert any(x['x'] == '/analytics-integration-check' and x['y'] >= 1 for x in responses['metrics-path'])
assert any(x['x'] == 'synthetic-local-integration-check' and x['y'] >= 1 for x in responses['metrics-event'])
assert responses['stats']['pageviews'] >= 1
assert responses['pageviews']['pageviews']
def shape(value):
    if isinstance(value, dict):
        return {key: shape(item) for key, item in value.items()}
    if isinstance(value, list):
        return [shape(value[0])] if value else []
    return type(value).__name__

print(json.dumps({key: shape(value) for key, value in responses.items()}, indent=2))
print('PASS: reporting token readback of real persisted synthetic pageview/event; all secret files 0600.')
