import http from 'node:http';
import { Problem, fail } from './store.mjs';

export function createAPI(store,{verifyToken,readMembers,origin}) {
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if(req.headers.origin===origin) {
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Vary','Origin');
      res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    }
    const send=(status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));};
    try {
      fail(!req.headers.origin||req.headers.origin===origin,'許可されていない接続元です',403);
      if(req.method==='OPTIONS') return send(204,{});
      fail(['GET','POST'].includes(req.method),'対応していないメソッドです',405);
      const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
      fail(token,'ログインしてください',401);
      let identity;
      try {identity=await verifyToken(token);} catch {throw new Problem(401,'ログインし直してください');}
      fail(identity?.uid && identity.email_verified===true && identity.firebase?.sign_in_provider!=='anonymous','確認済みメールアドレスでログインしてください',403);
      const uid=identity.uid;
      const url=new URL(req.url,'http://localhost'),parts=url.pathname.split('/').filter(Boolean);
      if(req.method==='GET'&&url.pathname==='/api/camps') return send(200,{camps:store.list(uid),admin:store.isAdmin(uid),uid});
      if(req.method==='POST'&&url.pathname==='/api/command') {
        return send(200,store.mutate(uid,await body(req)));
      }
      fail(parts[0]==='api'&&parts[1]==='camps'&&parts[2],'APIが見つかりません',404);
      const id=parts[2],c=store.get(id),r=store.role(c,uid);
      fail(r,'この合宿へのアクセス権限がありません',403);
      if(req.method==='GET'&&parts.length===3) return send(200,store.project(c,uid));
      if(req.method==='GET'&&parts[3]==='members') {
        fail(['admin','leader'].includes(r),'名簿取込の権限がありません',403);
        const source=await readMembers();
        return send(200,Object.entries(source||{}).filter(([,m])=>m&&typeof m.name==='string').map(([id,m])=>({id,name:m.name,grade:m.grade||''})));
      }
      if(req.method==='GET'&&parts[3]==='history') return send(200,store.history(uid,id));
      if(parts[3]==='locations') {
        if(req.method==='GET') return send(200,store.locations(uid,id));
        if(req.method==='POST'&&parts[4]) return send(200,store.location(uid,id,parts[4],await body(req)));
      }
      throw new Problem(404,'APIが見つかりません');
    } catch(error) {
      send(error.status||500,{error:error.status?error.message:'処理に失敗しました。時間をおいて再試行してください'});
      // 個人情報、リクエスト本文、トークンはログへ出さない。
      if(!error.status) console.error('Camp API internal failure');
    }
  });
}
async function body(req) {
  fail((req.headers['content-type']||'').startsWith('application/json'),'JSON形式で送信してください',415);
  let data='',bytes=0;
  for await(const chunk of req) {bytes+=chunk.length;fail(bytes<=65536,'一度に送信できるデータ量を超えています',413);data+=chunk;}
  try {return JSON.parse(data);} catch {throw new Problem(400,'送信内容が不正です');}
}
