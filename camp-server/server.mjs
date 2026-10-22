import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { createStore } from './store.mjs';
import { createAPI } from './http.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const {CAMP_ALLOWED_ORIGIN,CAMP_ADMIN_UIDS,CAMP_DB_FILE,FIREBASE_PROJECT_ID,FIREBASE_DATABASE_URL}=process.env;
if(!CAMP_ALLOWED_ORIGIN?.startsWith('https://')||!CAMP_ADMIN_UIDS||!CAMP_DB_FILE||!FIREBASE_PROJECT_ID||!FIREBASE_DATABASE_URL) {
  throw new Error('必須環境変数を設定してください。docs/camp-operations.md を参照してください。');
}
initializeApp({credential:applicationDefault(),projectId:FIREBASE_PROJECT_ID,databaseURL:FIREBASE_DATABASE_URL});
const filename=resolve(CAMP_DB_FILE);
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const relativeFile=relative(repository,filename);
if(relativeFile!=='..'&&!relativeFile.startsWith('..'+sep)&&!isAbsolute(relativeFile))throw new Error('CAMP_DB_FILE は公開リポジトリの外に置いてください');
if(new URL(CAMP_ALLOWED_ORIGIN).origin!==CAMP_ALLOWED_ORIGIN)throw new Error('CAMP_ALLOWED_ORIGIN はパスを含まないHTTPS originにしてください');
process.umask(0o077);
mkdirSync(dirname(filename),{recursive:true,mode:0o700});
const store=createStore(filename,CAMP_ADMIN_UIDS.split(',').map(x=>x.trim()).filter(Boolean));
const server=createAPI(store,{
  origin:CAMP_ALLOWED_ORIGIN,
  verifyToken:token=>getAuth().verifyIdToken(token,true),
  readMembers:async()=> (await getDatabase().ref('members_v2').get()).val()
});
store.purge();
const timer=setInterval(()=>store.purge(),60000);
server.listen(Number(process.env.PORT||8787),'127.0.0.1',()=>console.log('Camp API ready on loopback'));
process.on('SIGTERM',()=>server.close(()=>{clearInterval(timer);store.close();process.exit(0);}));
