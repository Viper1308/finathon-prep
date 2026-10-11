(function(){
'use strict';
const SECNAME={BF:'Business Finance',PF:'Personal Finance',SM:'Spreadsheet Modelling'};
const SECORDER=['SM','BF','PF'];
const R1={
 SM:['Formulae and Foundations','Lookups and data joins','Financial Functions','Dynamic Arrays','Model Design'],
 BF:['Financial Statements','Ratios and performance','Unit economics and business models','Banks and financial institutions','Valuation'],
 PF:['Time value of money and compounding','Income, tax and budgeting','Debt and credit','Insurance and risk','Investments and investment behaviour','Net worth and goals']
};
const EMPH={SM:1,BF:1};
const Q=DATA.questions; const byId={}; Q.forEach(q=>byId[q.id]=q);
const articles=STUDY; const artByTopic={}; articles.forEach(a=>artByTopic[a.r1]=a);
const $=(s,r)=> (r||document).querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- storage ---------- */
let store={answers:{},read:{}};
function load(){try{const s=localStorage.getItem('finprep-v1');if(s)store=Object.assign(store,JSON.parse(s));}catch(e){}}
function save(){try{localStorage.setItem('finprep-v1',JSON.stringify(store));}catch(e){}}
function theme(){try{return localStorage.getItem('finprep-theme')}catch(e){return null}}
load();
const th=theme(); if(th) document.documentElement.setAttribute('data-theme',th);
$('#themebtn').addEventListener('click',()=>{
  const cur=document.documentElement.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  const nx=cur==='dark'?'light':'dark'; document.documentElement.setAttribute('data-theme',nx);
  try{localStorage.setItem('finprep-theme',nx)}catch(e){}
});

/* ---------- formatting ---------- */
function fmtNum(v,f){
  if(typeof v==='string') return v;
  if(f==='pct') return (v*100).toLocaleString('en-IN',{maximumFractionDigits:3})+'%';
  if(f==='inr'||f==='inr2') return '₹'+v.toLocaleString('en-IN',{maximumFractionDigits:f==='inr2'?2:0,minimumFractionDigits:f==='inr2'?2:0});
  if(f==='x') return v.toLocaleString('en-IN',{maximumFractionDigits:3})+'×';
  return v.toLocaleString('en-IN',{maximumFractionDigits:4});
}
function parseAns(txt,fmt,target){
  let t=String(txt).trim().replace(/[₹,\s]/g,'').replace(/×|x$/i,'');
  if(t==='') return NaN;
  let pct=false; if(/%$/.test(t)){pct=true;t=t.slice(0,-1);}
  let v=Number(t); if(!isFinite(v)) return NaN;
  if(fmt==='pct'){ if(pct) v=v/100; else if(Math.abs(target)<=1.5 && Math.abs(v)>1.5) v=v/100; }
  return v;
}
function colName(i){let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
function colIdx(s){let n=0;for(const ch of s)n=n*26+(ch.charCodeAt(0)-64);return n-1;}
function cellPos(ref){const m=/^([A-Z]+)(\d+)/.exec(ref);return m?{c:colIdx(m[1]),r:+m[2]-1}:null;}

/* ---------- sheet grid ---------- */
function buildGrid(q){
  const sh=q.sheet, cells={}; let maxR=0,maxC=0; const set=(r,c,v,cls)=>{cells[r+','+c]={v,cls};maxR=Math.max(maxR,r);maxC=Math.max(maxC,c);};
  if(sh.table){
    const o=cellPos(sh.table.origin||'A1')||{r:0,c:0};
    sh.table.headers.forEach((h,i)=>{ if(h!=='') set(o.r,o.c+i,h,'hdr'); });
    sh.table.rows.forEach((row,ri)=>row.forEach((v,ci)=>{ if(v!=='') set(o.r+1+ri,o.c+ci,v,'num'); }));
  }
  sh.rows.forEach(r=>{
    const p=cellPos(r.cells.split(':')[0]);
    if(!sh.table && p) set(p.r,0,r.label,'lab');
    if(r.values){ r.values.forEach((v,i)=>set(p.r,p.c+i,v,'num')); }
    else if(p) set(p.r,p.c,r.value,typeof r.value==='number'?'num':'');
  });
  const tp=cellPos(sh.answer_cell); if(tp) set(tp.r,tp.c,'?','tgt');
  return {cells,maxR,maxC};
}
function gridHTML(q){
  const g=buildGrid(q), fmtOf={};
  q.sheet.rows.forEach(r=>{const p=cellPos(r.cells.split(':')[0]); if(p){const n=r.values?r.values.length:1;for(let i=0;i<n;i++)fmtOf[p.r+','+(p.c+i)]=r.format;}});
  let h='<div class="grid"><table><thead><tr><th class="rn"></th>';
  for(let c=0;c<=g.maxC;c++) h+='<th>'+colName(c)+'</th>'; h+='</tr></thead><tbody>';
  for(let r=0;r<=g.maxR;r++){ h+='<tr><th class="rn">'+(r+1)+'</th>';
    for(let c=0;c<=g.maxC;c++){ const k=r+','+c, ce=g.cells[k];
      if(!ce){h+='<td></td>';continue;}
      let v=ce.v; if(typeof v==='number'&&fmtOf[k]) v=fmtNum(v,fmtOf[k]);
      h+='<td class="'+(ce.cls||'')+'">'+esc(v)+'</td>'; }
    h+='</tr>'; }
  return h+'</tbody></table></div>';
}
function gridTSV(q){
  const g=buildGrid(q); const out=[];
  for(let r=0;r<=g.maxR;r++){const row=[];for(let c=0;c<=g.maxC;c++){const ce=g.cells[r+','+c];row.push(ce&&ce.cls!=='tgt'?String(ce.v):'');}out.push(row.join('\t'));}
  return out.join('\n');
}

/* ---------- derived stats ---------- */
function stat(filter){
  let seen=0,ok=0,tot=0;
  Q.forEach(q=>{ if(!filter(q))return; tot++; const a=store.answers[q.id]; if(a){seen++; if(a.ok)ok++;} });
  return {seen,ok,tot};
}
function pctClass(p){return p<0.5?'lo':p<0.75?'mid':''}

/* ---------- router ---------- */
let view='study', studyId='overview';
function setTabs(){ ['study','drill','progress'].forEach(v=>$('#tab-'+v).setAttribute('aria-selected',String(v===view))); }
function go(v,id,noScroll){ view=v; if(id) studyId=id; setTabs();
  try{history.replaceState(null,'', '#'+(v==='study'?(studyId==='overview'?'study':studyId):v));}catch(e){}
  render(); if(!noScroll) window.scrollTo(0,0); }
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));

function render(){ const m=$('#main'); m.innerHTML=''; if(view==='study') renderStudy(m); else if(view==='drill') renderDrill(m); else renderProgress(m); }

/* ---------- STUDY ---------- */
function railHTML(){
  let h='<button data-id="overview" '+(studyId==='overview'?'aria-current="true"':'')+'><span class="dot done" style="visibility:hidden"></span><span>Start here</span></button>';
  SECORDER.forEach(sec=>{
    h+='<h4>'+SECNAME[sec]+'</h4>';
    R1[sec].forEach(t=>{ const a=artByTopic[t]; if(!a) return;
      h+='<button data-id="'+a.id+'" '+(studyId===a.id?'aria-current="true"':'')+'><span class="dot '+(store.read[a.id]?'done':'')+'"></span><span>'+esc(t)+'</span></button>'; });
  });
  return h;
}
function renderStudy(m){
  const wrap=document.createElement('div'); wrap.className='study';
  const rail=document.createElement('nav'); rail.className='rail'; rail.setAttribute('aria-label','Topics'); rail.innerHTML=railHTML();
  const rd=document.createElement('article'); rd.className='reader';
  const sel=document.createElement('select'); sel.className='mobsel'; sel.setAttribute('aria-label','Choose topic'); sel.id='mobsel';
  let o='<option value="overview">Start here</option>'; SECORDER.forEach(sec=>{o+='<optgroup label="'+SECNAME[sec]+'">';R1[sec].forEach(t=>{const a=artByTopic[t];if(a)o+='<option value="'+a.id+'"'+(a.id===studyId?' selected':'')+'>'+esc(t)+'</option>';});o+='</optgroup>';});
  sel.innerHTML=o; sel.value=studyId;
  sel.addEventListener('change',()=>go('study',sel.value));
  const side=document.createElement('div'); side.append(sel);
  wrap.append(rail,rd); rd.before(); m.append(wrap);
  rd.append(sel);
  rail.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>go('study',b.dataset.id)));
  if(studyId==='overview') return overview(rd);
  const a=articles.find(x=>x.id===studyId)||articles[0];
  const n=Q.filter(q=>q.r1_topic===a.r1).length;
  const body=document.createElement('div'); body.innerHTML=
    '<div class="crumb">'+SECNAME[a.sec]+' · about '+a.min+' min</div><h1>'+esc(a.title)+'</h1>'+a.html;
  body.querySelectorAll('table').forEach(t=>{ if(t.parentElement.classList.contains('tw'))return; const w=document.createElement('div');w.className='tw';t.replaceWith(w);w.append(t);});
  rd.append(body);
  const idx=articles.findIndex(x=>x.id===a.id);
  const order=[]; SECORDER.forEach(s=>R1[s].forEach(t=>{if(artByTopic[t])order.push(artByTopic[t]);}));
  const pos=order.findIndex(x=>x.id===a.id), prev=order[pos-1], next=order[pos+1];
  const row=document.createElement('div'); row.className='btnrow';
  row.innerHTML='<button class="btn primary" id="prac">Practise this topic ('+n+' drills)</button>'+
    '<button class="btn '+(store.read[a.id]?'good':'')+'" id="markread">'+(store.read[a.id]?'Marked as read':'Mark as read')+'</button>'+
    (prev?'<button class="btn" id="pv">&larr; '+esc(prev.r1)+'</button>':'')+(next?'<button class="btn" id="nx">'+esc(next.r1)+' &rarr;</button>':'');
  rd.append(row);
  $('#prac').addEventListener('click',()=>{ drillCfg={sec:a.sec,topic:a.r1,type:'all',diff:'all',count:10,fresh:false}; go('drill'); });
  $('#markread').addEventListener('click',()=>{store.read[a.id]=!store.read[a.id];save();render();});
  if(prev)$('#pv').addEventListener('click',()=>go('study',prev.id)); if(next)$('#nx').addEventListener('click',()=>go('study',next.id));
}
function overview(rd){
  const done=Object.keys(store.read).filter(k=>store.read[k]).length;
  const c=document.createElement('div');
  c.innerHTML='<div class="crumb">Round 1 preparation</div><h1>Finathon Prep</h1>'+
   '<p class="lead">Sixteen study topics explained from first principles, and '+Q.length+' drill questions to test them. Spreadsheet Modelling and Business Finance carry the longest explanations, so start there. Every drill shows the reasoning after you answer.</p>'+
   '<div class="parts" id="parts"></div>'+
   '<div class="plan"><h3>How to use this</h3><ol>'+
   '<li>Read one topic (25 to 45 minutes). Keep a Google Sheet open and try the examples as you read.</li>'+
   '<li>Press <b>Practise this topic</b> and do 10 drills. Read every explanation, including the ones you got right.</li>'+
   '<li>Come back to topics where Progress shows under 75%.</li>'+
   '<li>Finish with a mixed round: pick all sections in Drill and set 45 questions.</li></ol>'+
   '<p class="note">You have read '+done+' of '+articles.length+' topics. Progress is saved in this browser only.</p></div>';
  rd.append(c); const P=c.querySelector('#parts');
  SECORDER.forEach(sec=>{ const d=document.createElement('div'); d.className='part';
    const secN=Q.filter(q=>q.section_code===sec).length;
    let h='<h2>'+SECNAME[sec]+'</h2><p>'+secN+' drills · '+(EMPH[sec]?'deepest explanations':'core concepts')+'</p>';
    R1[sec].forEach(t=>{const a=artByTopic[t]; if(!a)return; const n=Q.filter(q=>q.r1_topic===t).length;
      h+='<button data-id="'+a.id+'"><span>'+(store.read[a.id]?'✓ ':'')+esc(t)+'</span><span class="n">'+n+' drills</span></button>';});
    d.innerHTML=h; P.append(d); d.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>go('study',b.dataset.id)));});
}

/* ---------- DRILL ---------- */
let drillCfg={sec:'all',topic:'all',type:'all',diff:'all',count:10,fresh:false};
let sess=null, timer=null;
function pool(cfg){
  return Q.filter(q=>(cfg.sec==='all'||q.section_code===cfg.sec)&&(cfg.topic==='all'||q.r1_topic===cfg.topic)&&
    (cfg.type==='all'||q.type===cfg.type)&&(cfg.diff==='all'||String(q.difficulty)===cfg.diff)&&
    (!cfg.fresh||!(store.answers[q.id]&&store.answers[q.id].ok)));
}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function renderDrill(m){
  if(sess&&!sess.done) return renderQuestion(m);
  if(sess&&sess.done) return renderSummary(m);
  const d=document.createElement('div'); d.className='desk';
  const topics=drillCfg.sec==='all'?[]:R1[drillCfg.sec];
  const chips=(key,opts)=>opts.map(([v,l])=>'<button class="chip" data-k="'+key+'" data-v="'+v+'" aria-pressed="'+(String(drillCfg[key])===String(v))+'">'+l+'</button>').join('');
  d.innerHTML='<h1>Drill</h1><p class="note">Pick what to practise. Answers are checked against the same tolerance the answer key uses, so 10.83% and 0.1083 both count for a percentage.</p>'+
   '<div class="panel">'+
   '<div class="row"><label class="cap">Section</label>'+chips('sec',[['all','All'],['SM','Spreadsheet Modelling'],['BF','Business Finance'],['PF','Personal Finance']])+'</div>'+
   '<div class="row"><label class="cap" for="topicsel">Topic</label><select id="topicsel" '+(drillCfg.sec==='all'?'disabled':'')+'><option value="all">All topics'+(drillCfg.sec==='all'?' (choose a section first)':'')+'</option>'+topics.map(t=>'<option value="'+esc(t)+'"'+(drillCfg.topic===t?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></div>'+
   '<div class="row"><label class="cap">Question type</label>'+chips('type',[['all','Any'],['mcq','Multiple choice'],['numeric','Numeric'],['sheet','Spreadsheet task']])+'</div>'+
   '<div class="row"><label class="cap">Difficulty</label>'+chips('diff',[['all','Any'],['1','Easy'],['2','Medium'],['3','Hard']])+'</div>'+
   '<div class="row"><label class="cap">Number of questions</label>'+chips('count',[[5,'5'],[10,'10'],[20,'20'],[45,'45 (mock size)'],[9999,'All']])+'</div>'+
   '<div class="row"><label class="cap">Skip what you already got right</label><button class="chip" data-k="fresh" data-v="'+(!drillCfg.fresh)+'" aria-pressed="'+drillCfg.fresh+'">'+(drillCfg.fresh?'On':'Off')+'</button></div>'+
   '<div class="row" style="margin-top:18px"><button class="btn primary" id="start">Start</button><span class="hint" id="avail"></span></div></div>';
  m.append(d);
  const upd=()=>{const n=pool(drillCfg).length; $('#avail').textContent=n+' question'+(n===1?'':'s')+' match'; $('#start').disabled=n===0;};
  d.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.k; let v=b.dataset.v; if(k==='count')v=+v; if(k==='fresh')v=(v==='true');
    drillCfg[k]=v; if(k==='sec')drillCfg.topic='all'; render();}));
  const ts=$('#topicsel'); ts.addEventListener('change',()=>{drillCfg.topic=ts.value;upd();});
  upd();
  $('#start').addEventListener('click',()=>{
    const p=shuffle(pool(drillCfg)).slice(0,Math.min(drillCfg.count,9999));
    sess={qs:p,i:0,res:[],t0:Date.now(),checked:false,sel:null,done:false}; startTimer(); render(); });
}
function startTimer(){ clearInterval(timer); timer=setInterval(()=>{const e=$('#clock'); if(e&&sess&&!sess.done){const s=Math.floor((Date.now()-sess.t0)/1000);e.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}},1000); }
function renderQuestion(m){
  const q=sess.qs[sess.i], d=document.createElement('div'); d.className='desk';
  const diffName=['','Easy','Medium','Hard'][q.difficulty];
  const typeName={mcq:'Multiple choice',numeric:'Numeric',sheet:'Spreadsheet task'}[q.type];
  let h='<div class="sess-head"><span>Question '+(sess.i+1)+' of '+sess.qs.length+'</span><div class="bar"><i style="width:'+(sess.i/sess.qs.length*100)+'%"></i></div><span id="clock">00:00</span><button class="btn" id="quit" style="padding:4px 12px">End session</button></div>';
  h+='<div class="qcard"><div class="qmeta"><span>'+SECNAME[q.section_code]+'</span><span>'+esc(q.r1_topic)+'</span><span>'+typeName+'</span><span>'+diffName+'</span></div>';
  h+='<div class="stem">'+esc(q.stem)+'</div>';
  if(q.type==='mcq'){
    h+='<div class="opts" role="radiogroup">'+q.options.map(o=>'<button class="opt" role="radio" aria-checked="false" data-l="'+o.label+'"><b>'+o.label+'</b><span>'+esc(o.text)+'</span></button>').join('')+'</div>';
  } else {
    if(q.type==='sheet'){
      h+=gridHTML(q);
      h+='<div class="task">Fill cell <b>'+esc(q.sheet.answer_cell)+'</b> ('+esc(q.sheet.answer_label)+') with a formula. Type the number or text your formula returns.</div>';
      h+='<div class="row"><button class="btn" id="copytsv">Copy table for Google Sheets</button><span class="hint" id="copied"></span></div>';
    }
    const pf=q.answer.format==='pct'?'e.g. 10.5% or 0.105':(q.answer.format==='text'?'type the text':'e.g. 12,500');
    h+='<div class="ans"><input type="text" id="ansin" inputmode="'+(q.answer.format==='text'?'text':'decimal')+'" autocomplete="off" placeholder="Your answer" aria-label="Your answer"><button class="btn primary" id="check">Check</button><span class="hint">'+pf+'</span></div>';
  }
  if(q.type==='mcq') h+='<div class="ans"><button class="btn primary" id="check" disabled>Check</button></div>';
  h+='<div id="fb"></div></div>';
  d.innerHTML=h; m.append(d);
  sess.checked=false; sess.sel=null;
  $('#quit').addEventListener('click',()=>{endSession();});
  if(q.type==='mcq'){
    d.querySelectorAll('.opt').forEach(b=>b.addEventListener('click',()=>{ if(sess.checked)return; sess.sel=b.dataset.l;
      d.querySelectorAll('.opt').forEach(x=>x.setAttribute('aria-checked',String(x===b))); $('#check').disabled=false; }));
  } else {
    const inp=$('#ansin'); inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); if(!sess.checked)doCheck(q); else nextQ();}}); inp.focus({preventScroll:true});
    const cp=$('#copytsv'); if(cp)cp.addEventListener('click',()=>{ const t=gridTSV(q);
      const done=ok=>{$('#copied').textContent=ok?'Copied. Click cell A1 in a new sheet and paste.':'Copy is blocked here. Select the table and copy it by hand.';};
      try{navigator.clipboard.writeText(t).then(()=>done(true),()=>done(false));}catch(e){done(false);} });
  }
  $('#check').addEventListener('click',()=>{ if(!sess.checked)doCheck(q); else nextQ(); });
}
function doCheck(q){
  let ok=false, given='', right='';
  if(q.type==='mcq'){
    if(!sess.sel) return; given=sess.sel; ok=(given===q.correct_option);
    right=q.correct_option+'. '+q.options.find(o=>o.label===q.correct_option).text;
    document.querySelectorAll('.opt').forEach(b=>{ if(b.dataset.l===q.correct_option)b.classList.add('right'); else if(b.dataset.l===sess.sel)b.classList.add('wrong'); });
  } else {
    const raw=$('#ansin').value; if(!raw.trim()) return; given=raw;
    const a=q.answer;
    if(a.format==='text'){ ok=raw.trim().toLowerCase().replace(/\s+/g,'')===String(a.value).toLowerCase().replace(/\s+/g,''); right=String(a.value); }
    else { const v=parseAns(raw,a.format,a.value); ok=isFinite(v)&&Math.abs(v-a.value)<=a.tolerance_abs+1e-9; right=fmtNum(a.value,a.format); }
    $('#ansin').disabled=true;
  }
  sess.checked=true; sess.res.push({id:q.id,ok,given});
  const prev=store.answers[q.id]||{n:0}; store.answers[q.id]={ok:ok,n:(prev.n||0)+1,t:Date.now()}; save();
  let fb='<div class="fb '+(ok?'ok':'no')+'"><h4>'+(ok?'Correct':'Not quite')+'</h4>';
  if(!ok) fb+='<p>Correct answer: <b>'+esc(right)+'</b>'+(q.type!=='mcq'?' (you typed '+esc(given)+')':'')+'</p>';
  fb+='<p>'+esc(q.explanation)+'</p>';
  if(q.type==='sheet') fb+='<p>Formula for '+esc(q.sheet.answer_cell)+':</p><div class="fx">'+esc(q.sheet.solution_formula)+'</div>';
  fb+='<div class="row"><button class="btn primary" id="nextq">'+(sess.i+1>=sess.qs.length?'See results':'Next question')+'</button>';
  const art=artByTopic[q.r1_topic]; if(art) fb+='<button class="btn" id="why">Read about this topic</button>';
  fb+='</div></div>';
  $('#fb').innerHTML=fb; $('#check').textContent=sess.i+1>=sess.qs.length?'See results':'Next question'; $('#check').disabled=false;
  $('#nextq').addEventListener('click',nextQ); $('#nextq').focus({preventScroll:true});
  const w=$('#why'); if(w)w.addEventListener('click',()=>{ endSession(true); go('study',art.id); });
}
function nextQ(){ sess.i++; if(sess.i>=sess.qs.length){ sess.done=true; sess.t1=Date.now(); clearInterval(timer);} render(); window.scrollTo(0,0); }
function endSession(silent){ if(sess){ sess.done=true; sess.t1=Date.now(); clearInterval(timer);} if(silent){sess=null;return;} render(); }
function renderSummary(m){
  const d=document.createElement('div'); d.className='desk';
  const n=sess.res.length, ok=sess.res.filter(r=>r.ok).length, secs=Math.round((sess.t1-sess.t0)/1000);
  const miss=sess.res.filter(r=>!r.ok);
  let h='<h1>Session complete</h1><div class="panel"><div class="sum">'+ok+' / '+n+'</div><p class="note">'+(n?Math.round(ok/n*100):0)+'% correct in '+Math.floor(secs/60)+' min '+secs%60+' s'+(n<sess.qs.length?' (ended early)':'')+'.</p>';
  if(miss.length){ h+='<h3 style="margin:18px 0 0;font:700 17px var(--f-display)">Review what you missed</h3><div class="misslist">'+miss.map(r=>{const q=byId[r.id];
     const ans=q.type==='mcq'?q.options.find(o=>o.label===q.correct_option).text:fmtNum(q.answer.value,q.answer.format);
     return '<div class="miss"><b>'+esc(q.r1_topic)+'</b><br>'+esc(q.stem)+'<br><span class="hint">Answer: '+esc(ans)+'. '+esc(q.explanation)+'</span></div>';}).join('')+'</div>'; }
  h+='<div class="row" style="margin-top:20px">'+(miss.length?'<button class="btn primary" id="retry">Retry the '+miss.length+' missed</button>':'')+'<button class="btn" id="again">New session</button></div></div>';
  d.innerHTML=h; m.append(d);
  const rt=$('#retry'); if(rt)rt.addEventListener('click',()=>{ sess={qs:miss.map(r=>byId[r.id]),i:0,res:[],t0:Date.now(),checked:false,sel:null,done:false}; startTimer(); render(); });
  $('#again').addEventListener('click',()=>{sess=null;render();});
}

/* ---------- PROGRESS ---------- */
function renderProgress(m){
  const d=document.createElement('div'); d.className='prog';
  const all=stat(()=>true);
  let h='<h1>Progress</h1><p class="note">Accuracy counts the latest attempt on each question. Stored in this browser only.</p>';
  h+='<div class="panel"><div class="sum">'+all.ok+' <span style="font-size:22px;color:var(--muted)">of '+all.seen+' attempted correct · '+all.tot+' in bank</span></div></div>';
  SECORDER.forEach(sec=>{
    const s=stat(q=>q.section_code===sec);
    h+='<div class="sechead">'+SECNAME[sec]+'</div><div class="ptable"><div class="prow h"><span>Topic</span><span class="pnum">Done</span><span class="mt">Accuracy</span><span class="pnum">Right</span></div>';
    R1[sec].forEach(t=>{ const st=stat(q=>q.r1_topic===t); const acc=st.seen?st.ok/st.seen:0; const a=artByTopic[t];
      h+='<div class="prow"><span class="nm"><span>'+esc(t)+'</span><small>'+(a&&store.read[a.id]?'Read':'Not read yet')+'</small></span><span class="pnum">'+st.seen+'/'+st.tot+'</span><span class="meter"><i class="'+pctClass(acc)+'" style="width:'+Math.round(acc*100)+'%"></i></span><span class="pnum">'+(st.seen?Math.round(acc*100)+'%':'-')+'</span></div>'; });
    h+='</div>';
  });
  h+='<div class="row" style="margin-top:28px"><button class="btn" id="reset">Reset all progress</button><span class="hint" id="rsmsg"></span></div>';
  d.innerHTML=h; m.append(d);
  let armed=false; $('#reset').addEventListener('click',()=>{ if(!armed){armed=true;$('#reset').textContent='Click again to erase everything';return;} store={answers:{},read:{}};save();render(); });
}

/* ---------- boot ---------- */
(function(){ const h=(location.hash||'').slice(1);
  if(h==='drill'||h==='progress') view=h; else if(h&&articles.some(a=>a.id===h)){view='study';studyId=h;} })();
setTabs(); render();
})();
