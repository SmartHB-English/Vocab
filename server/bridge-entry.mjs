import {createLegacyEngine} from '../services/legacy-engine.generated.mjs';
import {TableStore} from '../services/table-store.mjs';
import {createRuntime} from '../services/legacy-runtime.mjs';
import {pack,unpack,publicTable,tableMetadata,sheetId} from '../services/store-codec.mjs';
import {toField,fromField} from '../services/firestore-wire.mjs';
globalThis.VocabBridgeCore= {createLegacyEngine,TableStore,createRuntime,pack,unpack,publicTable,tableMetadata,sheetId,toField,fromField};
