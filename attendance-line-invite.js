(function(root){
  "use strict";
  const categoryOf=entry=>entry.category||"その他";
  const compareCategory=(a,b)=>a.localeCompare(b,"ja",{numeric:true});
  function sorted(entries){
    return entries.slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.startTime||"").localeCompare(b.startTime||"")||
      compareCategory(categoryOf(a),categoryOf(b))||a.title.localeCompare(b.title,"ja")||a.id.localeCompare(b.id));
  }
  function matchUrl(entry,base){
    const url=new URL("attendance-preview.html",base);
    url.search=new URLSearchParams({match:entry.id,date:entry.date});
    return url.href;
  }
  function buildMessage(entries,base,dateLabel){
    if(!entries.length)return "";
    const blocks=sorted(entries).map(entry=>[
      dateLabel(entry.date)+"｜"+categoryOf(entry)+"｜"+entry.title,
      entry.meeting?"集合 "+entry.meeting:"",
      entry.place?"会場 "+entry.place:"",
      matchUrl(entry,base)
    ].filter(Boolean).join("\n"));
    return ["【試合参加のご案内】","各試合のリンクからお子さんの名前を選び、○参加・△未定・×不参加を入力してください。","",blocks.join("\n\n")].join("\n");
  }

  function setup(dialog,dateLabel,base){
    const get=id=>dialog.querySelector("#line-invite-"+id);
    const list=get("list"),category=get("category"),all=get("all"),clear=get("clear");
    const count=get("count"),preview=get("preview"),copy=get("copy"),status=get("status");
    const selected=new Set();
    let entries=[],signature,ready=false;
    const shown=()=>entries.filter(entry=>!category.value||categoryOf(entry)===category.value);

    function updateSelection(){
      const visible=shown();
      const visibleCount=visible.filter(entry=>selected.has(entry.id)).length;
      count.textContent=selected.size+"件選択中"+(selected.size>visibleCount?"（うち非表示 "+(selected.size-visibleCount)+"件）":"");
      all.disabled=!ready||!visible.length||visible.length===visibleCount;
      clear.disabled=!selected.size;
      list.querySelectorAll("input").forEach(input=>{input.checked=selected.has(input.value);});
      preview.value=buildMessage(entries.filter(entry=>selected.has(entry.id)),base,dateLabel);
      copy.disabled=!ready||!preview.value;
      status.textContent="";
    }

    function renderList(){
      list.replaceChildren(...shown().map(entry=>{
        const row=document.createElement("label");
        const input=document.createElement("input");
        input.type="checkbox";
        input.value=entry.id;
        row.append(input,...[dateLabel(entry.date).replace(/^\d{4}年/,""),categoryOf(entry),entry.title].map(text=>{
          const span=document.createElement("span");
          span.textContent=text;
          return span;
        }));
        return row;
      }));
      updateSelection();
    }

    category.addEventListener("change",renderList);
    list.addEventListener("change",event=>{
      const input=event.target;
      if(!input.matches('input[type="checkbox"]'))return;
      if(input.checked)selected.add(input.value);
      else selected.delete(input.value);
      updateSelection();
    });
    all.addEventListener("click",()=>{
      shown().forEach(entry=>selected.add(entry.id));
      updateSelection();
    });
    clear.addEventListener("click",()=>{selected.clear();updateSelection();});
    copy.addEventListener("click",async ()=>{
      if(!preview.value)return;
      try {
        await navigator.clipboard.writeText(preview.value);
      } catch(error) {
        preview.focus();
        preview.select();
        try {
          if(!document.execCommand("copy"))throw error;
        } catch(copyError) {
          status.textContent="自動でコピーできませんでした。選択された案内文を長押ししてコピーしてください。";
          return;
        }
      }
      status.textContent="案内文をコピーしました。LINEに貼り付けてください。";
    });

    return function refresh(events,message){
      get("availability").textContent=message;
      ready=Boolean(events);
      if(!ready){copy.disabled=true;all.disabled=true;return;}
      const next=JSON.stringify(events);
      if(signature===next){updateSelection();return;}
      signature=next;
      entries=sorted(events);
      const ids=new Set(entries.map(entry=>entry.id));
      selected.forEach(id=>{if(!ids.has(id))selected.delete(id);});
      const oldCategory=category.value;
      const groups=Array.from(new Set(entries.map(categoryOf))).sort(compareCategory);
      category.replaceChildren(new Option("すべて",""),...groups.map(group=>new Option(group,group)));
      category.value=groups.includes(oldCategory)?oldCategory:"";
      category.disabled=!groups.length;
      renderList();
    };
  }
  root.SMCAttendanceLineInvite={matchUrl,buildMessage,setup};
})(typeof window==="undefined"?globalThis:window);
