import copy
import hashlib
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/migration'))
from firestore_snapshot import canonical, decode, documents, firestore_value, import_snapshot


class FakeDB:
    def __init__(self):
        self.data = {}
        self.writes = 0
        self.fail_after = None
    def read_many(self, paths):
        return {p: copy.deepcopy(self.data[p]) for p in paths if p in self.data}
    def create_many(self, values):
        if self.fail_after is not None and self.writes >= self.fail_after:
            raise OSError('injected unavailable')
        for p, v in values.items():
            if p in self.data:
                raise ValueError('already exists')
            self.data[p] = copy.deepcopy(v)
            self.writes += 1


def fixture():
    content = {'version':1,'localTimezone':'Asia/Seoul','excelEpoch':'1899-12-30T00:00:00',
        'sheets':[{'name':'학생','state':'visible','maxRow':2,'maxColumn':1,'mergedRanges':[],
            'cells':[{'row':1,'column':1,'value':{'type':'string','value':'이름'}},
                     {'row':2,'column':1,'value':{'type':'string','value':'가상학생'},'note':'full\nwrong words'}]}]}
    return {'sourceSha256':'synthetic','contentSha256':hashlib.sha256(canonical(content)).hexdigest(),'content':content}


class ImportTests(unittest.TestCase):
    def test_roundtrip_types(self):
        data = {'a':None,'b':True,'c':3,'d':3.25,'e':'0011','f':[],'g':{},'h':[{'a':'한글'}]}
        self.assertEqual(decode(firestore_value(data)),data)
    def test_integral_double_json_preserves_double_type(self):
        self.assertIsInstance(decode({'doubleValue': 100}), float)
        self.assertEqual(canonical(decode({'doubleValue': 100})), b'100.0')
    def test_import_and_noop_retry(self):
        db = FakeDB()
        first = import_snapshot(db,fixture(),batch_size=1)
        writes = db.writes
        self.assertEqual(import_snapshot(db,fixture(),batch_size=1),first)
        self.assertEqual(db.writes,writes)
        self.assertEqual(first['state'],'verified')
    def test_partial_failure_never_publishes_and_resumes(self):
        db = FakeDB(); db.fail_after=1
        root,_,_ = documents(fixture())
        with self.assertRaises(OSError):
            import_snapshot(db,fixture(),batch_size=1)
        self.assertNotIn(root,db.data)
        db.fail_after=None
        import_snapshot(db,fixture(),batch_size=1)
        self.assertEqual(db.data[root]['state'],'verified')
    def test_conflict_stops_without_overwrite(self):
        db = FakeDB(); root,docs,_ = documents(fixture())
        path = next(iter(docs)); db.data[path]={'unexpected':'content'}
        before=copy.deepcopy(db.data)
        with self.assertRaisesRegex(ValueError,'differs'):
            import_snapshot(db,fixture())
        self.assertEqual(before,db.data)
        self.assertNotIn(root,db.data)
    def test_tampered_input_is_rejected(self):
        data=fixture(); data['content']['sheets'][0]['name']='changed'
        with self.assertRaisesRegex(ValueError,'hash'):
            documents(data)
    def test_corrupted_readback_never_publishes(self):
        class CorruptDB(FakeDB):
            def create_many(self, values):
                super().create_many(values)
                for path in values:
                    self.data[path]={'corrupted':True}
        db=CorruptDB(); root,_,_=documents(fixture())
        with self.assertRaisesRegex(ValueError,'verification'):
            import_snapshot(db,fixture())
        self.assertNotIn(root,db.data)

if __name__ == '__main__':
    unittest.main()
