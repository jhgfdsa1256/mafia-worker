// 화면 JS ⑦ JSON 추출 도구
export const clientTools = `function copyText(t){
  if(navigator.clipboard&&navigator.clipboard.writeText){return navigator.clipboard.writeText(t);}
  return new Promise(function(res,rej){
    var ta=document.createElement("textarea");
    ta.value=t;ta.style.position="fixed";ta.style.opacity="0";
    document.body.appendChild(ta);ta.select();
    var ok=false;try{ok=document.execCommand("copy");}catch(e){}
    document.body.removeChild(ta);
    ok?res():rej();
  });
}

function buildJsonTools(){
  var notes=Object.keys(ANN).map(function(k){
    var m=/^t(\\d+)$/.exec(k); // 투표 결과 카드에 단 주석
    var i=m?Number(m[1]):Number(k);
    var l=DATA.logs[i]||{};
    return {
      index:i,
      kind:m?"vote_result":"line",
      nickname:m?null:(l.nickname||null),
      from:m?null:(l.from||null),
      to:m?null:(l.to||null),
      message:m?"[투표 결과]":(l.message||null),
      note:ANN[k]
    };
  }).sort(function(a,b){return a.index-b.index;});
  var text=JSON.stringify(Object.assign({},DATA,{annotations:notes}),null,2);
  var out=document.getElementById("toolsOut");
  out.textContent="";
  var wrap=el("div","tools-out");
  wrap.appendChild(el("div","info","JSON 준비됨 ("+Math.max(1,Math.round(text.length/1024))+" KB, 주석 "+notes.length+"개 포함)"));
  var dl=el("button",null,"다운로드");
  dl.onclick=function(){
    var blob=new Blob([text],{type:"application/json"});
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="mafia42_"+ID+".json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  };
  var cp=el("button","sec","복사");
  var st=el("div","info","");
  cp.onclick=function(){
    copyText(text).then(function(){st.textContent="복사했어요.";},function(){st.textContent="복사하지 못했어요. 다운로드를 이용해 주세요.";});
  };
  wrap.appendChild(dl);wrap.appendChild(cp);wrap.appendChild(st);
  out.appendChild(wrap);
}

`;
