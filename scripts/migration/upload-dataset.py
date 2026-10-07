"""Stage immutable service documents in the new project; no live web switch."""
import argparse
import json
from pathlib import Path
from firestore_snapshot import Firestore, canonical

p=argparse.ArgumentParser()
p.add_argument('--project',required=True)
p.add_argument('--firebase-account',required=True)
a=p.parse_args()
config=json.loads((Path.home()/'.config/configstore/firebase-tools.json').read_text())
account=next(x for x in config.get('additionalAccounts',[])+[config] if x.get('user',{}).get('email')==a.firebase_account)
db=Firestore(a.project,account['tokens']['access_token'])
staged=json.loads(Path('work/dataset-documents.json').read_text())
docs=dict(staged['documents'])
paths=list(docs)
for i in range(0,len(paths),50):
 batch=paths[i:i+50]
 found=db.read_many(batch)
 if any(canonical(found[p])!=canonical(docs[p]) for p in found):
  raise SystemExit('Existing staged data differs; refusing overwrite')
 db.create_many({p:docs[p] for p in batch if p not in found})
for i in range(0,len(paths),50):
 batch=paths[i:i+50];found=db.read_many(batch)
 if set(found)!=set(batch) or any(canonical(found[p])!=canonical(docs[p]) for p in batch):
  raise SystemExit('Read-back validation failed')
root='runtime/config'
current=db.read_many([root])
if root not in current: db.create_many({root:{'dataset':staged['dataset'],'state':'staged'}})
print(json.dumps({'dataset':staged['dataset'],'documentsVerified':len(docs),'state':'staged'}))
