// Display-only order for camp rosters. Never rewrite stored Firestore records.
const names=new Intl.Collator('ja',{numeric:true,sensitivity:'base'});

export function gradeRank(value){
 const g=String(value??'').normalize('NFKC').replace(/\s+/g,'');
 const grade=g.match(/(?:小学(?:校)?|小)?([1-6])年(?:生)?/);
 if(grade)return Number(grade[1]);
 if(g.includes('年長'))return 0;
 if(g.includes('年中'))return -1;
 if(g.includes('年少'))return -2;
 return -100;
}

export function compareGradeAndName(a,b){
 const diff=gradeRank(b.grade)-gradeRank(a.grade);
 if(diff)return diff;
 return names.compare(String(a.kana||a.name||''),String(b.kana||b.name||''))
  ||names.compare(String(a.name||''),String(b.name||''))
  ||names.compare(String(a.id||''),String(b.id||''));
}

export function orderedParticipants(items){
 return [...items].sort(compareGradeAndName);
}
