// 화면 JS ⑤ 주석 보기/편집
export const clientAnnotate = `// ---- 주석 보기/편집 ----
function renderAnn(slot,idx,editing,mode){
  slot.textContent="";
  if(editing){
    var box=el("div","ann "+mode);
    var ta=document.createElement("textarea");
    ta.rows=3;ta.value=ANN[idx]||"";ta.placeholder="이 줄에 대한 주석";
    var bar=el("div","annbar");
    var st=el("span","info","");
    var ok=el("button",null,"저장");
    var del=el("button","sec","삭제");
    var no=el("button","sec","취소");
    ok.onclick=function(){
      var v=ta.value.trim();
      if(v){ANN[idx]=v;}else{delete ANN[idx];}
      var p=persistAnn(idx);
      OPEN=null;renderAnn(slot,idx,false,mode);
      p.then(function(saved){
        if(!saved)slot.appendChild(el("div","annbar")).appendChild(el("span","info",ME.loggedIn?"서버에 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.":"이 브라우저에는 저장하지 못했어요 (비공개 모드 등)."));
      });
    };
    del.onclick=function(){delete ANN[idx];persistAnn(idx);OPEN=null;renderAnn(slot,idx,false,mode);};
    no.onclick=function(){OPEN=null;renderAnn(slot,idx,false,mode);};
    bar.appendChild(ok);bar.appendChild(del);bar.appendChild(no);bar.appendChild(st);
    box.appendChild(ta);box.appendChild(bar);
    slot.appendChild(box);
    ta.focus();
  }else if(ANN[idx]){
    var n=el("div","ann "+mode);
    var note=el("div","note",ANN[idx]);
    note.onclick=function(){openEditor(slot,idx,mode);};
    n.appendChild(note);
    slot.appendChild(n);
  }
}
function openEditor(slot,idx,mode){
  if(OPEN&&OPEN.slot===slot)return;
  if(OPEN)renderAnn(OPEN.slot,OPEN.idx,false,OPEN.mode);
  OPEN={slot:slot,idx:idx,mode:mode};
  renderAnn(slot,idx,true,mode);
}

`;
