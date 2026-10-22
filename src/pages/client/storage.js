// 화면 JS ② 주석 저장/불러오기 (브라우저 또는 계정)
export const clientStorage = `// ---- 주석 저장 (이 브라우저의 localStorage) ----
function annKey(){return "m42ann:"+LANG+":"+ID;}
function loadAnn(){
  try{var s=localStorage.getItem(annKey());var o=s?JSON.parse(s):{};ANN=(o&&typeof o==="object")?o:{};}
  catch(e){ANN={};}
}
function saveLocal(){
  try{localStorage.setItem(annKey(),JSON.stringify(ANN));return true;}
  catch(e){return false;}
}
// 로그인했으면 서버(계정)에, 아니면 이 브라우저에 저장. 항상 Promise<boolean>
var ME={configured:false,loggedIn:false,name:null};
function persistAnn(key){
  if(!ME.loggedIn)return Promise.resolve(saveLocal());
  return fetch("/api/annotations/"+LANG+"/"+ID,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:String(key),note:ANN[key]||""})})
    .then(function(r){return r.ok;},function(){return false;});
}
function loadAnnServer(){
  return fetch("/api/annotations/"+LANG+"/"+ID).then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(d&&d.notes){ANN=d.notes;return true;}return false;
  },function(){return false;});
}
function localNotes(){
  try{var s=localStorage.getItem(annKey());var o=s?JSON.parse(s):{};return(o&&typeof o==="object")?o:{};}catch(e){return {};}
}
`;
