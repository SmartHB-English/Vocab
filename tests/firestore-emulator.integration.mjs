import test from 'node:test';
import assert from 'node:assert/strict';

// Dedicated demo project only. This test must never contact a live project.
const project = 'demo-smarthb-vocab';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
assert.match(firestoreHost ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
assert.match(authHost ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
const base = `http://${firestoreHost}/v1/projects/${project}/databases/(default)/documents`;
let idToken;
test('Auth emulator: create a synthetic signed-in user',async()=>{
  const response=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true}),
  });
  assert.equal(response.status,200);
  const body=await response.json(); assert.ok(body.idToken); idToken=body.idToken;
});
for(const auth of ['anonymous','signed-in']) {
  for(const collection of ['students','credentials','records']) {
    test(`Firestore rules: ${auth} cannot read or write ${collection}`,async()=>{
      const headers={'Content-Type':'application/json'};
      if(auth==='signed-in') { assert.ok(idToken); headers.Authorization=`Bearer ${idToken}`; }
      const path=`${base}/${collection}/fixture`;
      const write=await fetch(path,{method:'PATCH',headers,body:JSON.stringify({fields:{fixture:{booleanValue:true}}})});
      assert.equal(write.status,403);
      assert.equal((await write.json()).error.status,'PERMISSION_DENIED');
      const read=await fetch(path,{headers});
      assert.equal(read.status,403);
      assert.equal((await read.json()).error.status,'PERMISSION_DENIED');
    });
  }
}
