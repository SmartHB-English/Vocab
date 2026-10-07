"""Owner-only CAS selector; never alters or deletes academy data."""
import argparse
import json
from pathlib import Path
from firestore_snapshot import Firestore, decode, firestore_value
p=argparse.ArgumentParser()
p.add_argument('--project',required=True)
p.add_argument('--firebase-account',required=True)
p.add_argument('--expect-state',choices=['staged','frozen','active'],required=True)
p.add_argument('--state',choices=['staged','frozen','active'],required=True)
p.add_argument('--dataset',required=True)
a=p.parse_args()
if a.project!='smarthb-vocab-20261007':raise SystemExit('Unexpected destination')
if (a.expect_state,a.state) not in [('staged','frozen'),('frozen','frozen'),('frozen','active'),('active','frozen'),('frozen','staged')]:raise SystemExit('Transition is not supported')
config=json.loads((Path.home()/'.config/configstore/firebase-tools.json').read_text())
account=next(x for x in config.get('additionalAccounts',[])+[config] if x.get('user',{}).get('email')==a.firebase_account)
db=Firestore(a.project,account['tokens']['access_token'])
root=db.request('GET',db.prefix+'runtime/config')
current=decode({'mapValue':{'fields':root['fields']}})
if current['state']!=a.expect_state:raise SystemExit('Selector state changed; refusing mutation')
if a.dataset!=current['dataset'] and a.state!='frozen':raise SystemExit('A new dataset must first be selected while frozen')
if not db.read_many(['vocabDatasets/'+a.dataset+'/meta/catalog']):raise SystemExit('Target catalog does not exist')
if a.state=='active':
 staged=json.loads(Path('work/dataset-documents.json').read_text())
 if staged['dataset']!=a.dataset:raise SystemExit('Local verification destination differs')
 from firestore_snapshot import canonical
 expected=dict(staged['documents']);actual={}
 for start in range(0,len(expected),30):actual.update(db.read_many(list(expected)[start:start+30]))
 if set(expected)!=set(actual) or any(canonical(v)!=canonical(actual[k]) for k,v in expected.items()):raise SystemExit('Target read-back verification failed')
value={**current,'state':a.state,'dataset':a.dataset}
db.request('POST',db.prefix[:-1]+':commit',{'writes':[{'update':{'name':db.prefix+'runtime/config','fields':firestore_value(value)['mapValue']['fields']},'currentDocument':{'updateTime':root['updateTime']}}]})
if db.read_many(['runtime/config'])['runtime/config']!=value:raise SystemExit('Selector read-back differs')
print(json.dumps({'state':a.state,'dataset':a.dataset,'selectorVerified':True}))
