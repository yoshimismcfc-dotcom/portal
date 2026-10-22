// 使用: node backup.mjs /private/camps.sqlite /private/backups/camps-YYYYMMDD.sqlite
import {DatabaseSync} from 'node:sqlite';
import {existsSync,chmodSync} from 'node:fs';
import {resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw new Error('元DBと新しいバックアップファイルのパスを指定してください');
const target=resolve(destination),repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),rel=relative(repo,target);
if((rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel))||existsSync(target))throw new Error('公開リポジトリ外の、未使用の出力先を指定してください');
process.umask(0o077);
const db=new DatabaseSync(resolve(source),{readOnly:true});
try {db.prepare('VACUUM INTO ?').run(target);} finally {db.close();}
chmodSync(target,0o600);
const backup=new DatabaseSync(target,{readOnly:true});
try {if(backup.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('バックアップの整合性検査に失敗しました');}finally{backup.close();}
console.log('バックアップ作成と整合性検査が完了しました。個人情報を含むため限定保管してください。');
