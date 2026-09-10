import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('accounting.html','utf8');
const source=html.match(/<script>\s*var KEY="smc_accounting_v1";([\s\S]*?)<\/script>/)[1];
const nodes=new Map();
function node(id){
  if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',hidden:true,setAttribute(k,v){this[k]=v;},addEventListener(){},classList:{add(){},remove(){},toggle(){}},parentElement:{querySelectorAll(){return [node('name'),node('unit'),node('qty')];}}});
  return nodes.get(id);
}
const listeners={};let writes=0,success,failure;
const context=vm.createContext({console,URLSearchParams,location:{search:''},setTimeout(){},confirm:()=>true,
  document:{getElementById:node,querySelector:s=>s.includes('aria-invalid')?[...nodes.values()].find(n=>n['aria-invalid']==='true')||null:null,querySelectorAll:()=>[]},
  window:{addEventListener(){},setTimeout(){}},localStorage:{getItem:()=>null,setItem(){}},
  dbListen:(path,fn)=>listeners[path]=fn,dbSave:(path,data,key,ok,err)=>{writes++;success=ok;failure=err;}
});
vm.runInContext('var KEY="smc_accounting_v1";'+source,context);
context.flash=()=>{};
context.data={tournaments:[{id:'test',name:'テスト大会',carry:100,income:[{name:'参加費',unit:'',qty:'',memo:''}],expense:[{name:'会場費',unit:1000,qty:2,memo:''}]}]};
context.editLine('income',0,'unit','￥３，０００');
assert.equal(context.data.tournaments[0].income[0].qty,1);
assert.equal(node('income-amt-0').textContent,'3,000円');
context.editLine('income',0,'qty','4');
assert.equal(context.balanceAt(0),10000);
assert.equal(context.closingAt(0),10100);
assert.match(node('report-sheet').innerHTML,/12,000円/);
assert.match(node('totals').innerHTML,/10,100円/);
context.editLine('income',0,'unit','0');assert.equal(context.total(context.data.tournaments[0],'income'),0);
context.editLine('income',0,'unit','');assert.equal(context.total(context.data.tournaments[0],'income'),0);
context.editLine('income',0,'unit','abc');context.saveData();assert.equal(writes,0);
assert.equal(node('unit')['aria-invalid'],'true');
context.editLine('income',0,'unit','100');context.editLine('income',0,'qty','1.5');
assert.equal(context.total(context.data.tournaments[0],'income'),150);
assert.equal(context.lineAmount({unit:500,qty:''}),0,'Historical blank quantities remain unchanged');
context._accountingCloudReady=true;context.saveData();context.saveData();assert.equal(writes,1,'Duplicate save blocked');
success({cloudSaved:true});assert.equal(context.accountingDirty,false);
assert.match(node('accounting-save-status').textContent,/クラウドに保存/);
context.editLine('income',0,'unit','200');context.saveData();failure({localSaved:true});
assert.equal(context.accountingDirty,true);assert.match(node('accounting-save-status').textContent,/保存できません/);
context.accountingBaseline=JSON.stringify({tournaments:[]});
listeners.accounting({tournaments:[{id:'remote'}]},{authoritative:true});
assert.equal(context.data.tournaments[0].id,'test','Remote update must not replace dirty edits');
assert.equal(context.accountingPending.tournaments[0].id,'remote');
context.saveData();assert.equal(writes,2,'Pending remote update blocks overwrite');
console.log('accounting input/calculation/save tests: OK');
