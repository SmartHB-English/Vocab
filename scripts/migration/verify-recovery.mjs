import {readFileSync} from 'node:fs';
import {TableStore} from '../../services/table-store.mjs';
import {pack} from '../../services/store-codec.mjs';
const source=TableStore.fromSnapshot(JSON.parse(readFileSync('work/source/snapshot.normalized.json')));
const restored=TableStore.fromSnapshot(JSON.parse(readFileSync(process.argv[2]??'work/recovery-staged.normalized.json')));
let count=0,notes=0;
for(const table of source.getSheets()){
 const actual=restored.getSheetByName(table.name);if(!actual)throw Error('Missing sheet');
 for(const[key,cell]of Object.entries(table.cells)){
  const candidate=actual.cells[key]??{value:'',note:'',format:'General'};
  if(pack(cell)!==pack(candidate))throw Error('Recovery cell differs in '+table.name+' at '+key);
  count++;if(cell.note)notes++;
 }
 for(const[key,cell]of Object.entries(actual.cells))if(!table.cells[key]&&(cell.value!==''||cell.note))throw Error('Unexpected recovery cell');
}
if(source.getSheets().length!==restored.getSheets().length)throw Error('Sheet count differs');
console.log(JSON.stringify({sheets:source.getSheets().length,cellsVerified:count,notesVerified:notes,result:'match'}));
