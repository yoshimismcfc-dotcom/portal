(function(root){
  "use strict";

  function nameKey(name){
    return String(name||"").normalize("NFKC").replace(/\s+/g,"").replace(/コーチ$/,"");
  }

  function findByName(rows,name){
    var key=nameKey(name);
    return key&&rows.find(function(row){
      return row&&String(row.name||"").split(/[、，,\n]/).some(function(item){
        return nameKey(item)===key;
      });
    });
  }

  async function update(db,change){
    if(!db)throw new Error("coach-roster-unavailable");
    var ref=db.ref("staff/coach");
    // Populate the SDK cache before running a transaction on an existing array.
    await ref.once("value");
    return ref.transaction(function(value){
      var rows=Array.isArray(value)?value:Object.values(value||{});
      return change(rows);
    },undefined,false);
  }

  async function add(db,name){
    var entry={id:"s"+crypto.randomUUID(),role:"コーチ",name:name,note:"",phone:"",qualifications:""};
    var result=await update(db,function(rows){
      if(findByName(rows,name))return;
      return rows.concat(entry);
    });
    return {saved:result.committed,rows:result.snapshot.val()};
  }

  root.SMCCoachRoster={nameKey:nameKey,findByName:findByName,update:update,add:add};
})(typeof window==="undefined"?globalThis:window);
