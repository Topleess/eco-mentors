#!/usr/bin/env python3
"""One-time isolated local bootstrap. Secrets never go to stdout."""
import json
import os
from pathlib import Path
import secrets
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
BASE = 'http://127.0.0.1:18185'
NAME = 'ЭкоКарьера — локальная разработка'


def private_json(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as out:
        json.dump(data, out, ensure_ascii=False, indent=2)
        out.write('\n')


def request(path, body=None, token=None, method=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            data = res.read()
            return json.loads(data) if data else {}
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Umami {req.get_method()} {path}: HTTP {error.code}') from None


def main():
    if (ROOT / 'integration.json').exists():
        raise SystemExit('Already bootstrapped; use verify.py. No credentials changed.')
    path = ROOT / 'credentials.json'
    if path.exists():
        credentials = json.loads(path.read_text())
    else:
        credentials = {'adminUsername': 'admin', 'adminPassword': secrets.token_urlsafe(32),
                       'reportingUsername': 'openmentor-local-reporting',
                       'reportingPassword': secrets.token_urlsafe(32)}
        private_json(path, credentials)
    try:
        login = request('/api/auth/login', {'username': 'admin', 'password': credentials['adminPassword']})
    except RuntimeError:
        login = request('/api/auth/login', {'username': 'admin', 'password': 'umami'})
        request('/api/users/' + login['user']['id'], {'password': credentials['adminPassword']}, login['token'])
        login = request('/api/auth/login', {'username': 'admin', 'password': credentials['adminPassword']})
    try:
        request('/api/auth/login', {'username': 'admin', 'password': 'umami'})
    except RuntimeError:
        pass
    else:
        raise SystemExit('Default admin password remains enabled')
    token = login['token']
    users = request('/api/admin/users', token=token)['data']
    user = next((u for u in users if u['username'] == credentials['reportingUsername']), None)
    if user is None:
        user = request('/api/users', {'username': credentials['reportingUsername'],
                                     'password': credentials['reportingPassword'], 'role': 'view-only'}, token)
    assert request('/api/users/' + user['id'], token=token)['role'] == 'view-only'
    teams = request('/api/teams', token=token)['data']
    team = next((t for t in teams if t['name'] == 'OpenMentor local analytics'), None)
    if team is None:
        request('/api/teams', {'name': 'OpenMentor local analytics'}, token)
        team = next(t for t in request('/api/teams', token=token)['data'] if t['name'] == 'OpenMentor local analytics')
    member_path = '/api/teams/' + team['id'] + '/users'
    members = request(member_path, token=token)['data']
    if not any(m['userId'] == user['id'] for m in members):
        request(member_path, {'userId': user['id'], 'role': 'team-view-only'}, token)
    members = request(member_path, token=token)['data']
    assert any(m['userId'] == user['id'] and m['role'] == 'team-view-only' for m in members)
    websites = request('/api/admin/websites', token=token)['data']
    website = next((w for w in websites if w['name'] == NAME and w['teamId'] == team['id']), None)
    if website is None:
        website = request('/api/websites', {'name': NAME, 'domain': 'localhost', 'teamId': team['id']}, token)
    saved = request('/api/websites/' + website['id'], token=token)
    assert saved['name'] == NAME and saved['domain'] == 'localhost'
    reporting = request('/api/auth/login', {'username': credentials['reportingUsername'],
                                          'password': credentials['reportingPassword']})
    assert reporting['user']['role'] == 'view-only' and not reporting['user']['isAdmin']
    assert request('/api/websites/' + website['id'], token=reporting['token'])['id'] == website['id']
    # Valid but no-op update: denied permission must be enforced by the real server.
    try:
        request('/api/websites/' + website['id'], {'name': NAME}, reporting['token'])
    except RuntimeError as error:
        assert 'HTTP 401' in str(error) or 'HTTP 403' in str(error)
    else:
        raise SystemExit('Reporting user unexpectedly has website write access')
    private_json(ROOT / 'integration.json', {'serverUrl': BASE, 'websiteId': website['id'],
                                           'token': reporting['token'], 'publicUrl': BASE})
    print('Bootstrap verified: default password disabled; team-view-only reporting; website writes denied.')
    print('Private integration.json and credentials.json saved (0600).')


if __name__ == '__main__':
    main()
