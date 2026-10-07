"""Immutable, resumable backup import. Does not switch application traffic."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
from normalize_xlsx import canonical


def firestore_value(v):
    if v is None:
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, list):
        return {"arrayValue": {"values": [firestore_value(x) for x in v]}}
    if isinstance(v, dict):
        return {"mapValue": {"fields": {k: firestore_value(x) for k, x in v.items()}}}
    raise TypeError(type(v).__name__)


def decode(v):
    if 'nullValue' in v:
        return None
    if 'integerValue' in v:
        return int(v['integerValue'])
    if 'doubleValue' in v:
        return float(v['doubleValue'])
    if 'booleanValue' in v:
        return v['booleanValue']
    if 'stringValue' in v:
        return v['stringValue']
    if 'arrayValue' in v:
        return [decode(x) for x in v['arrayValue'].get('values', [])]
    if 'mapValue' in v:
        return {k: decode(x) for k, x in v['mapValue'].get('fields', {}).items()}
    raise ValueError('Unsupported Firestore field type')


def documents(snapshot):
    content = snapshot['content']
    digest = hashlib.sha256(canonical(content)).hexdigest()
    if digest != snapshot['contentSha256']:
        raise ValueError('Snapshot content hash mismatch')
    root = f'migrationSnapshots/{digest}'
    result = {}
    for position, sheet in enumerate(content['sheets']):
        sid = hashlib.sha256(sheet['name'].encode()).hexdigest()
        path = f'{root}/sheets/{sid}'
        result[path] = {k: v for k, v in sheet.items() if k != 'cells'} | {'position': position}
        rows = {}
        for cell in sheet['cells']:
            rows.setdefault(cell['row'], []).append(cell)
        for row, cells in rows.items():
            result[f'{path}/rows/{row:08d}'] = {'row': row, 'cells': cells}
    for data in result.values():
        if len(canonical(firestore_value(data))) > 900000:
            raise ValueError('Row too large for Firestore; shard before importing')
    manifest = {k: v for k, v in snapshot.items() if k != 'content'}
    manifest |= {k: v for k, v in content.items() if k != 'sheets'}
    manifest |= {'sheetCount': len(content['sheets']), 'documentCount': len(result), 'state': 'verified'}
    return root, result, manifest


class Firestore:
    def __init__(self, project, token):
        self.prefix = f'projects/{project}/databases/(default)/documents/'
        self.token = token

    def request(self, method, suffix, body=None):
        req = urllib.request.Request('https://firestore.googleapis.com/v1/' + suffix,
            data=None if body is None else canonical(body), method=method,
            headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.load(response)

    def read_many(self, paths):
        values = self.request('POST', self.prefix[:-1] + ':batchGet',
                              {'documents': [self.prefix + p for p in paths]})
        result = {}
        for item in values:
            if 'found' in item:
                d = item['found']
                result[d['name'][len(self.prefix):]] = decode({'mapValue': {'fields': d.get('fields', {})}})
        return result

    def create_many(self, values):
        writes = [{'update': {'name': self.prefix + p, 'fields': firestore_value(v)['mapValue']['fields']},
                   'currentDocument': {'exists': False}} for p, v in values.items()]
        if writes:
            self.request('POST', self.prefix[:-1] + ':commit', {'writes': writes})


def import_snapshot(db, snapshot, batch_size=100):
    root, docs, manifest = documents(snapshot)
    paths = list(docs)
    for offset in range(0, len(paths), batch_size):
        batch = paths[offset:offset + batch_size]
        existing = db.read_many(batch)
        for path, value in existing.items():
            if canonical(value) != canonical(docs[path]):
                raise ValueError('Existing snapshot document differs; import stopped')
        db.create_many({p: docs[p] for p in batch if p not in existing})
    # Re-read every document; a successful write alone is not verification.
    for offset in range(0, len(paths), batch_size):
        batch = paths[offset:offset + batch_size]
        found = db.read_many(batch)
        if set(found) != set(batch) or any(canonical(found[p]) != canonical(docs[p]) for p in batch):
            raise ValueError('Read-back verification failed')
    existing = db.read_many([root])
    if root in existing:
        if canonical(existing[root]) != canonical(manifest):
            raise ValueError('Snapshot manifest conflict')
    else:
        db.create_many({root: manifest})
    if db.read_many([root]).get(root) != manifest:
        raise ValueError('Manifest verification failed')
    return {'snapshotId': root.split('/')[-1], 'documentsVerified': len(docs), 'state': 'verified'}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('snapshot', type=Path)
    p.add_argument('--project', required=True)
    p.add_argument('--firebase-account')
    args = p.parse_args()
    token = os.environ.get('GOOGLE_OAUTH_ACCESS_TOKEN')
    if not token and args.firebase_account:
        config = json.loads((Path.home() / '.config/configstore/firebase-tools.json').read_text())
        accounts = config.get('additionalAccounts', []) + [config]
        account = next(a for a in accounts if a.get('user', {}).get('email') == args.firebase_account)
        token = account['tokens']['access_token']
    if not token:
        p.error('Provide GOOGLE_OAUTH_ACCESS_TOKEN or a logged-in --firebase-account')
    try:
        print(json.dumps(import_snapshot(Firestore(args.project, token), json.loads(args.snapshot.read_text()))))
    except urllib.error.HTTPError as e:
        raise SystemExit(f'Firestore HTTP {e.code}; no response body or credentials logged')


if __name__ == '__main__':
    main()
