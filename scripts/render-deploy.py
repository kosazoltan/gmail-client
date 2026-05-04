#!/usr/bin/env python3
import json
import os
import sys
import time
import urllib.error
import urllib.request


API_BASE = 'https://api.render.com/v1'
SUCCESS_STATUSES = {'live', 'succeeded', 'success'}
FAILURE_STATUSES = {
    'build_failed',
    'update_failed',
    'pre_deploy_failed',
    'canceled',
    'cancelled',
    'failed',
}


def request_json(path, method='GET', body=None):
    api_key = os.environ['RENDER_API_KEY']
    data = None if body is None else json.dumps(body).encode('utf-8')
    request = urllib.request.Request(
        f'{API_BASE}{path}',
        data=data,
        method=method,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'ZMail-GitHubActions-RenderDeploy/1.0',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            text = response.read().decode('utf-8')
            return json.loads(text) if text.strip() else {}
    except urllib.error.HTTPError as error:
        details = error.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'Render API HTTP {error.code} for {method} {path}: {details}') from error


def payload_items(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ('services', 'data', 'items'):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def find_service_id(service_name):
    cursor = None
    while True:
        path = '/services?limit=100'
        if cursor:
            path += f'&cursor={cursor}'
        payload = request_json(path)
        for item in payload_items(payload):
            service = item.get('service', item) if isinstance(item, dict) else {}
            if service.get('name') == service_name:
                return service.get('id')
        cursor = payload.get('cursor') if isinstance(payload, dict) else None
        if not cursor:
            break
    raise RuntimeError(f'Render service not found by name: {service_name}')


def deploy_status(payload):
    deploy = payload.get('deploy', payload) if isinstance(payload, dict) else {}
    return deploy.get('status') or deploy.get('state')


def deploy_id(payload):
    deploy = payload.get('deploy', payload) if isinstance(payload, dict) else {}
    return deploy.get('id')


def main():
    service_name = os.environ.get('RENDER_SERVICE_NAME', 'gmail-client-api')
    print(f'Render service keresése: {service_name}')
    service_id = find_service_id(service_name)
    print('Render deploy indítása...')
    created = request_json(f'/services/{service_id}/deploys', method='POST', body={})
    current_deploy_id = deploy_id(created)
    if not current_deploy_id:
        raise RuntimeError(f'Render deploy id missing from response: {created}')
    print(f'Render deploy létrejött: {current_deploy_id}')

    deadline = time.monotonic() + 14 * 60
    last_status = None
    while time.monotonic() < deadline:
        current = request_json(f'/services/{service_id}/deploys/{current_deploy_id}')
        status = deploy_status(current)
        if status != last_status:
            print(f'Render deploy státusz: {status}')
            last_status = status
        if status in SUCCESS_STATUSES:
            print('Render deploy kész.')
            return
        if status in FAILURE_STATUSES:
            raise RuntimeError(f'Render deploy failed with status: {status}')
        time.sleep(15)
    raise RuntimeError(f'Render deploy timeout; last status: {last_status}')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)