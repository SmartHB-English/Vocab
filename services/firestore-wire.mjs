export function toField(value) {
  if(value===null)return{nullValue:null};
  if(typeof value==='boolean')return{booleanValue:value};
  if(typeof value==='number')return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  if(typeof value==='string')return{stringValue:value};
  if(Array.isArray(value))return{arrayValue:{values:value.map(toField)}};
  if(value&&typeof value==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,toField(v)]))}};
  throw new Error('Unsupported Firestore value');
}
export function fromField(value) {
  if('nullValue'in value)return null;
  if('booleanValue'in value)return value.booleanValue;
  if('integerValue'in value)return Number(value.integerValue);
  if('doubleValue'in value)return Number(value.doubleValue);
  if('stringValue'in value)return value.stringValue;
  if('arrayValue'in value)return(value.arrayValue.values??[]).map(fromField);
  if('mapValue'in value)return Object.fromEntries(Object.entries(value.mapValue.fields??{}).map(([k,v])=>[k,fromField(v)]));
  throw new Error('Unsupported Firestore field');
}
