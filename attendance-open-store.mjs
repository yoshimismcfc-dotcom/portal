// Public pilot attendance, independent of legacy #test share links.
// Uses a separate RTDB namespace. Never modifies legacy Firestore answers.
const ROOT = "attendance_open_v1";
const ESCAPED_ID_PREFIX = "smc-id:";
const INVALID_KEY = /[.#$\[\]/\u0000-\u001f\u007f]/;

function storageId(id) {
  // Keep existing valid keys. Escape the prefix itself to make decoding unambiguous.
  return INVALID_KEY.test(id)||id.startsWith(ESCAPED_ID_PREFIX)
    ? ESCAPED_ID_PREFIX+encodeURIComponent(id).replace(/\./g,"%2E") : id;
}

function logicalId(id) {
  if(!id.startsWith(ESCAPED_ID_PREFIX))return id;
  try{return decodeURIComponent(id.slice(ESCAPED_ID_PREFIX.length));}
  catch{return id;}
}

function recruitmentRecord(record) {
  return {...record,decisions:Object.fromEntries(Object.entries(record?.decisions||{})
    .map(([id,decision])=>[logicalId(id),decision]))};
}


function answerField(row, field) {
  return row?.[field] || (field === "contact" ? {} : "");
}

function sameField(field, a, b) {
  if (field !== "contact") return a === b;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key]);
}

export function loadOpenAttendance() {
  return new Promise((resolve,reject)=>{
    if(typeof window.onFirebaseReady!=="function") { reject(new Error("firebase-unavailable"));return; }
    window.onFirebaseReady(db=>{
      if(!db){reject(new Error("firebase-unavailable"));return;}
      const key=(eventId,group,personId)=>[group,eventId,personId].map(part => encodeURIComponent(part).replace(/\./g, "%2E")).join(":");
      const answers=db.ref(ROOT+"/answers");
      const listenMap=(path,receive,unavailable,transform=(v)=>new Map(Object.entries(v||{})))=>{
        const ref=db.ref(ROOT+"/"+path);
        ref.on("value",snap=>receive(transform(snap.val())),e=>unavailable(e?.message||"クラウドの読込に失敗しました"));
        return ()=>ref.off();
      };
      const tx=(ref,update,conflict="shared-attendance-conflict")=>new Promise((ok,fail)=>{
        ref.transaction(update,(error,committed,snap)=>{
          if(error)fail(error);else if(!committed)fail(new Error(conflict));else ok(snap.val());
        },false);
      });
      resolve({
        key,
        listen(receive,unavailable){return listenMap("answers",receive,unavailable);},
        async save(group,personId,updates,note,baseline,confirmed=new Map()){
          const changes=updates.map(update=>{
            const fields={};
            if(update.value!==undefined)fields.value=update.value;
            if(update.contact!==undefined)fields.contact=update.contact||{};
            return {eventId:update.id,fields};
          });
          if(note!==undefined)changes.push({eventId:"",fields:{note}});
          const conflicts=new Map();
          const attempts=await Promise.allSettled(changes.map(async ({eventId,fields})=>{
            const id=key(eventId,group,personId),original=baseline.get(id);
            const edited=Object.keys(fields).filter(field=>!sameField(field,answerField(original,field),fields[field]));
            if(!edited.length)return;
            await new Promise((resolve,reject)=>{
              let conflictingFields;
              answers.child(id).transaction(current=>{
                const pending=edited.filter(field=>!sameField(field,answerField(current,field),fields[field]));
                const checked=confirmed.get(id);
                conflictingFields=pending.filter(field=>{
                  const value=answerField(current,field);
                  return !sameField(field,answerField(original,field),value)&&
                    !(checked&&Object.hasOwn(checked,field)&&sameField(field,checked[field],value));
                });
                if(conflictingFields.length||!pending.length)return;
                const row={eventId,group,personId,value:answerField(current,"value"),
                  contact:answerField(current,"contact"),note:answerField(current,"note"),
                  revision:(current?.revision||0)+1,updatedAt:Date.now()};
                pending.forEach(field=>{row[field]=fields[field];});
                return row;
              },(error,committed,snapshot)=>{
                if(error){reject(error);return;}
                if(!committed&&conflictingFields?.length){
                  const current=snapshot.val();
                  conflicts.set(id,Object.fromEntries(conflictingFields.map(field=>[field,answerField(current,field)])));
                }
                resolve();
              },false);
            });
          }));
          const failure=attempts.find(attempt=>attempt.status==="rejected");
          if(failure)throw failure.reason;
          return conflicts;
        },
        eventVisibility:{
          listen(receive,unavailable){return listenMap("eventVisibility",receive,unavailable,v=>new Map(Object.entries(v||{}).map(([id,row])=>[id,Boolean(row?.excluded)])));},
          save(eventId,excluded){return db.ref(ROOT+"/eventVisibility/"+eventId).set({excluded,updatedAt:Date.now()});},
          async importExcluded(ids){for(const id of ids){const ref=db.ref(ROOT+"/eventVisibility/"+id);await tx(ref,v=>v||{excluded:true,updatedAt:Date.now()});}}
        },
        holidays:{
          listen(receive,unavailable){return listenMap("holidayExclusions",receive,unavailable,v=>new Set(Object.keys(v||{}).filter(id=>v[id]?.excluded===true)));},
          save(date,excluded){return db.ref(ROOT+"/holidayExclusions/"+date).set({excluded,updatedAt:Date.now()});}
        },
        recruitment:{
          listen(receive,unavailable){
            return listenMap("recruitment",receive,unavailable,records=>new Map(
              Object.entries(records||{}).map(([id,record])=>[logicalId(id),recruitmentRecord(record)])));
          },
          async save(eventId,changes,baselineRevision){
            const ref=db.ref(ROOT+"/recruitment").child(storageId(eventId));
            const saved=await tx(ref,current=>{
              if((current?.revision||0)!==baselineRevision)return;
              const decisions=Object.assign(Object.create(null),current?.decisions);
              for(const [personId,decision] of changes){
                const id=storageId(personId);
                if(decision==="default")delete decisions[id];
                else decisions[id]=decision;
              }
              return {decisions:{...decisions},revision:baselineRevision+1,updatedAt:Date.now()};
            },"recruitment-conflict");
            return recruitmentRecord(saved);
          }
        }
      });
    });
  });
}
