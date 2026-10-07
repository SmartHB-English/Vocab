import datetime as dt
import importlib.util
from pathlib import Path
import tempfile
import unittest
import openpyxl
from openpyxl.comments import Comment

spec = importlib.util.spec_from_file_location('snapshot', Path(__file__).resolve().parents[2] / 'scripts/migration/normalize_xlsx.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class SnapshotTests(unittest.TestCase):
    def test_preserves_types_notes_positions_and_is_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fake.xlsx'
            w = openpyxl.Workbook()
            s = w.active
            s.title = '학생'
            s['A1'] = '0011'
            s['B1'] = 11
            s['C1'] = False
            s['A3'] = dt.datetime(2026, 10, 7, 0, 0, 1)
            s['B3'].comment = Comment('틀린 단어 6개\na\nb\nc\nd\ne\nf', 'fixture')
            s['D3'] = '=B1+1'
            w.create_sheet('빈 시트')
            w.save(path)
            one = m.snapshot(path)
            self.assertEqual(one, m.snapshot(path))
            sheets = one['content']['sheets']
            self.assertEqual([s['name'] for s in sheets], ['학생', '빈 시트'])
            cells = {(c['row'], c['column']): c for c in sheets[0]['cells']}
            self.assertEqual(cells[1,1]['value'], {'type':'string','value':'0011'})
            self.assertEqual(cells[1,2]['value'], {'type':'number','value':11})
            self.assertEqual(cells[1,3]['value'], {'type':'boolean','value':False})
            self.assertEqual(cells[3,1]['value'], {'type':'datetime','value':'2026-10-07T00:00:01'})
            self.assertEqual(cells[3,2]['note'], '틀린 단어 6개\na\nb\nc\nd\ne\nf')
            self.assertEqual(cells[3,2]['value'], {'type':'blank'})
            self.assertEqual(cells[3,4]['excelType'], 'f')
            self.assertEqual(cells[3,4]['cachedValue'], {'type':'blank'})
            s['B3'].comment = Comment('changed', 'fixture')
            w.save(path)
            self.assertNotEqual(one['contentSha256'], m.snapshot(path)['contentSha256'])

    def test_rejects_unsupported_values(self):
        with self.assertRaises(TypeError):
            m.encode(object())
        with self.assertRaises(ValueError):
            m.encode(float('nan'))


if __name__ == '__main__':
    unittest.main()
