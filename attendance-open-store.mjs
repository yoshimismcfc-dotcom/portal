// Public pilot attendance, independent of legacy #test share links.
// Uses a separate RTDB namespace. Never modifies legacy Firestore answers.
const ROOT = "attendance_open_v1";
export function loadOpenAttendance() {
  return new Promise((resolve,reject)=>{
    if(typeof window.onFirebaseReady!=="function") { reject(new Error("firebase-unavailable"));return; }
    window.onFirebaseReady(db=>{
      if(!db){reject(new Error("firebase-unavailable"));return;}
      const key=(eventId,group,personId)=>[group,eventId,personId].map(encodeURIComponent).join(":");
      const answers=db.ref(ROOT+"/answers");
      const listenMap=(path,receive,unavailable,transform=(v)=>new Map(Object.entries(v||{})))=>{
        const ref=db.ref(ROOT+"/"+path);
        ref.on("value",snap=>receive(transform(snap.val())),e=>unavailable(e?.message||"クラウドの読込に失敗しました"));
        return ()=>ref.off();
      };
      const tx=(ref,update)=>new Promise((ok,fail)=>{
        ref.transaction(update,(error,committed,snap)=>{
          if(error)fail(error);else if(!committed)fail(new Error("shared-attendance-conflict"));else ok(snap.val());
        },false);
      });
      resolve({
        key,
        listen(receive,unavailable){return listenMap("answers",receive,unavailable);},
        async save(group,personId,updates,note,baseline){
          const changes=updates.map(u=>{
            const id=key(u.id,group,personId),original=baseline.get(id);
            return {id,original,data:{eventId:u.id,value:u.value,contact:u.contact===undefined?(original?.contact||{}):(u.contact||{}),note:""}};
          });
          if(note!==undefined){const id=key("",group,personId);changes.push({id,original:baseline.get(id),data:{eventId:"",value:"",contact:{},note}});}
          for(const {id,original,data} of changes){
            if((original?.value||"")===(data.value||"")&&(original?.note||"")===(data.note||"")&&JSON.stringify(original?.contact||{})===JSON.stringify(data.contact))continue;
            await tx(answers.child(id),current=>{
              if((current?.revision||0)!==(original?.revision||0))return;
              return {...data,group,personId,revision:(original?.revision||0)+1,updatedAt:Date.now()};
            });
          }
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
          listen(receive,unavailable){return listenMap("recruitment",receive,unavailable);},
          async save(eventId,changes,baselineRevision){
            return tx(db.ref(ROOT+"/recruitment/"+eventId),current=>{
              if((current?.revision||0)!==baselineRevision)return;
              const decisions={...(current?.decisions||{})};
              for(const [personId,decision] of changes){if(decision==="default")delete decisions[personId];else decisions[personId]=decision;}
              return {decisions,revision:baselineRevision+1,updatedAt:Date.now()};
            });
          }
        }
      });
    });
  });
}
