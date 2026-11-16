/* Leather -> Libraries and Paper -> Admin tabs.
   Runs after the clay script, so it reuses: IC, S (for education), save, clamp, fmt, pct,
   nobleAdd, ticon, makeTechSlider, techAt, isPhone, MODULES, ACTIVE, setMbar, showTab. */

/* ---------- small DOM helpers ---------- */
const el = html => { const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };
const WA = Math.log((400-10)/1990)/Math.log(0.5);
const wfToW = p => { const w=10+1990*Math.pow(p/1000,WA); const st=w<100?1:w<1000?5:10; return clamp(Math.round(w/st)*st,10,2000); };
const wfToP = w => Math.round(1000*Math.pow((w-10)/1990,1/WA));
const loadState = (key, def) => { try{ const s=JSON.parse(localStorage.getItem(key)||'null'); if(s) return Object.assign(def, s); }catch(e){} return def; };
const saveState = (key, st) => { try{ localStorage.setItem(key, JSON.stringify(st)); }catch(e){} };

function addRange(parent, c){
  const box = el(`<div class="ctl ${c.primary?'primary':''}">
    <div class="ctl-head"><img class="px" src="${IC[c.icon]}" alt=""><label for="${c.id}">${c.label}</label><output id="${c.id}-o" class="num"></output></div>
    <input type="range" id="${c.id}" min="${c.wf?0:c.min}" max="${c.wf?1000:c.max}" step="${c.wf?1:c.step}">
    <div class="ends">${c.ends.map(e=>`<span>${e}</span>`).join('')}</div>
    ${c.wf?`<div class="wstep"><button type="button" data-d="-1" aria-label="Fewer workers">−</button><button type="button" data-d="1" aria-label="More workers">+</button></div>`:''}
  </div>`);
  parent.appendChild(box);
  const inp=box.querySelector('input'), o=box.querySelector('output'), sc=c.scale||1;
  const sync=()=>{ inp.value = c.wf ? wfToP(c.get()) : c.get()*sc; o.textContent=c.show(c.get()); };
  inp.oninput=()=>{ c.set(c.wf ? wfToW(+inp.value) : +inp.value/sc); o.textContent=c.show(c.get()); c.onChange(); };
  box.querySelectorAll('.wstep button').forEach(b=>b.onclick=()=>{
    const d=+b.dataset.d, W=c.get(), step=(d>0?W>=1000:W>1000)?50:(d>0?W>=100:W>100)?10:5;
    c.set(clamp(W+d*step,10,2000)); sync(); c.onChange();
  });
  sync();
  return {sync};
}

function addNoble(parent, id, n, ic, title, who, onChange){
  const box = el(`<div class="noble"></div>`); parent.appendChild(box);
  const draw = ()=>{
    box.innerHTML = `
      <div class="row"><img class="px" src="${IC.noble}" alt="">
        <label class="tick"><input type="checkbox" id="${id}-on" ${n.on?'checked':''}> ${title} <span class="muted">+250%</span></label>
        <img class="px" src="${IC[ic]}" alt=""></div>
      ${n.on ? (n.gran ? `
        <div class="gran"><label for="${id}-c">Nobles</label><input type="number" id="${id}-c" min="1" max="20" value="${n.count}">
          <label for="${id}-r">Rank</label><input type="number" id="${id}-r" min="0" max="10" value="${n.rank}">
          <span>covers <b class="num">${fmt(50*n.count*(1+2*n.rank))}</b> ${who}</span>
          <button class="linkbtn" id="${id}-g">Cover everyone</button></div>`
        : `<div class="gran"><span>Covers all ${who}.</span><button class="linkbtn" id="${id}-g">Set nobles and rank</button></div>`) : ''}`;
    box.querySelector(`#${id}-on`).onchange=e=>{ n.on=e.target.checked; draw(); onChange(); };
    const g=box.querySelector(`#${id}-g`); if(g) g.onclick=()=>{ n.gran=!n.gran; draw(); onChange(); };
    const c=box.querySelector(`#${id}-c`), r=box.querySelector(`#${id}-r`);
    const cov=()=>{ box.querySelector('.gran b').textContent=fmt(50*n.count*(1+2*n.rank)); };
    if(c) c.oninput=()=>{ n.count=clamp(Math.round(+c.value||1),1,20); cov(); onChange(); };
    if(r) r.oninput=()=>{ n.rank=clamp(Math.round(+r.value||0),0,10); cov(); onChange(); };
  };
  draw();
}

function addToggle(parent, c){
  const box = el(`<label class="tgl">${ticon(c.fg, c.ov, c.bg)}<input type="checkbox" id="${c.id}">
    <span><span class="nm">${c.name}</span><br><span class="meta">${c.meta}</span></span></label>`);
  parent.appendChild(box);
  const inp=box.querySelector('input'); inp.checked=!!c.get();
  inp.onchange=()=>{ c.set(inp.checked); c.onChange(); };
}

/* A linear tech path for makeTechSlider: techs -> steps, cumulative adds and costs */
function techPath(techs){
  const steps=[], offset=[]; let o=0;
  techs.forEach((t,ti)=>{ offset.push(o); for(let j=1;j<=t.lv;j++){ steps.push({ti,j,cost:t.cost[Math.min(j-1,t.cost.length-1)],cur:t.cur||'innovation',add:t.add||0,kind:t.kind||'add'}); o++; } });
  const add=[0], spentI=[0], spentK=[0], cnt={};
  steps.forEach((s,i)=>{ add.push(add[i]+s.add); spentI.push(spentI[i]+(s.cur==='innovation'?s.cost:0)); spentK.push(spentK[i]+(s.cur==='knowledge'?s.cost:0)); });
  return {techs, steps, offset, add, spentI, spentK, N:steps.length};
}
const costBetween = (P,a,b) => ({i:P.spentI[b]-P.spentI[a], k:P.spentK[b]-P.spentK[a]});
const costText = c => [c.i?`${fmt(c.i)} innovation`:'', c.k?`${fmt(c.k)} knowledge`:''].filter(Boolean).join(' + ') || '–';

function slider(prefix, P, c){
  return makeTechSlider({
    id:prefix, label:c.label, steps:P.steps, techs:P.techs, offset:P.offset, fg:c.fg, bg:c.bg,
    set:c.set, onChange:c.onChange,
    bubble:k=>{
      const a=techAt(P.steps,P.techs,k);
      if(!a) return `${ticon(c.fg,'tech0',c.bg)}<div><div class="nm">${c.none}</div><div class="meta">${c.noneMeta||''}</div></div>`;
      return `${ticon(c.fg,a.t.ov,c.bg)}<div><div class="nm">${a.label}</div><div class="meta">${a.t.eff}</div></div>`;
    },
    foot:k=>{
      const parts=[`<span>${c.bonusLabel} <b>${c.bonus(k)}</b></span>`];
      if(P.spentI[k] || !P.spentK[P.N]) parts.push(`<span>Innovation spent <b class="spend i">${fmt(P.spentI[k])}</b></span>`);
      if(P.spentK[P.N]) parts.push(`<span>Knowledge spent <b class="spend k">${fmt(P.spentK[k])}</b></span>`);
      if(c.earn && k>0){ const e=c.earn(); parts.push(e.v>0.05
        ? `<span>In exchange <b class="spend g">+${fmt(e.v,1)}</b> ${e.unit}${badge(costBetween(P,0,k), e.v, e.unit, !!c.direct)}</span>`
        : `<span><b class="spend z">Not contributing</b> to ${e.unit}${badge(costBetween(P,0,k), e.v, e.unit, !!c.direct)}</span>`); }
      return parts.join('');
    },
  });
}

/* The page skeleton every new tab shares */
function buildTab(prefix, cfg){
  const root=document.getElementById('tab-'+prefix);
  root.innerHTML = `
    <section class="panel" aria-label="Research">
      <h2>Research <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400;font-size:.82rem">set what you have researched</span></h2>
      <div class="research ${cfg.sliders.length===3?'three':'two'}">${cfg.sliders.map(s=>`
        <div class="ts"><div class="ts-title"><h3>${s.title}</h3><span class="muted">${s.sub}</span></div><div class="ts-stage" id="${prefix}-ts-${s.key}"></div></div>`).join('')}
      </div>
      <div class="toggles" id="${prefix}-tgl" style="margin-top:14px"></div>
      <div class="pay" id="${prefix}-pay"></div>
    </section>
    <div class="grid">
      <aside class="panel" aria-label="Settings" id="${prefix}-ctl"><h2>Your city</h2></aside>
      <div class="col">
      <main class="panel" aria-live="polite">
        <div class="verdict" id="${prefix}-v"></div>
        <div class="alloc"><div class="alloc-bar" id="${prefix}-bar" role="img" aria-label="Workforce split"></div><div class="alloc-legend" id="${prefix}-leg"></div></div>
        <div class="tiles" id="${prefix}-tiles"></div>
        <div class="byp" id="${prefix}-byp"></div>
        <div class="cmp-wrap"><table class="cmp" id="${prefix}-cmp"></table></div>
      </main>
      <section class="panel" aria-label="What more research would buy">
        <h2><img class="px" src="${IC.tech0 && IC.innov_book}" alt="">What more research would buy</h2>
        <p class="hint">${cfg.moreHint}</p>
        <div class="cmp-wrap"><table class="cmp" id="${prefix}-more"></table></div>
      </section>
      </div>
    </div>
    <section class="panel"><details class="notes"><summary>How the numbers are worked out</summary><ul>${cfg.notes.map(n=>`<li>${n}</li>`).join('')}</ul></details></section>`;
  return {
    ctl: root.querySelector(`#${prefix}-ctl`), tgl: root.querySelector(`#${prefix}-tgl`), pay: root.querySelector(`#${prefix}-pay`), earn:{},
    v: root.querySelector(`#${prefix}-v`), bar: root.querySelector(`#${prefix}-bar`), leg: root.querySelector(`#${prefix}-leg`),
    tiles: root.querySelector(`#${prefix}-tiles`), byp: root.querySelector(`#${prefix}-byp`),
    cmp: root.querySelector(`#${prefix}-cmp`), more: root.querySelector(`#${prefix}-more`),
  };
}

function drawAlloc(D, segs){
  D.bar.innerHTML = segs.filter(s=>s.n>0).map(s=>`<div style="flex-grow:${s.n};background:${s.color}" title="${s.label}"></div>`).join('');
  D.leg.innerHTML = segs.map(s=>`<span><span class="sw" style="background:${s.color}"></span><img class="px" src="${IC[s.ic]}" alt="">${s.label} <b>${fmt(s.n)}</b></span>`).join('');
}
const drawTiles = (D, t) => { D.tiles.innerHTML = t.map(([k,v,s])=>`<div class="tile"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join(''); };
function drawTable(tbl, cols, rows){
  tbl.innerHTML = `<thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>`+
    rows.map(r=>`<tr class="${r.best?'best':''}">${r.cells.map((v,i)=>i===0?`<td>${v}</td>`:`<td data-label="${cols[i]}">${v}</td>`).join('')}</tr>`).join('')+`</tbody>`;
}
function renderVerdictBox(D, yes, tag, head, body){
  D.v.className='verdict '+(yes?'yes':'no');
  D.v.innerHTML=`<span class="tag">${tag}</span><h3>${head}</h3><p>${body}</p>`;
}
const SEG = { room:'var(--innov)', p1:'var(--clay)', p2:'var(--good)', haul:'var(--haul)' };

/* Payback summary: what a group of trees cost and what it adds, compared with having none of it */
function drawPay(D, rows, unit){
  D.pay.innerHTML = rows.filter(r=>r.cost.i||r.cost.k).map(r=>{
    const per = r.cost.i && !r.cost.k && r.gain>0.05 ? `<span class="per">${fmt(100*r.gain/r.cost.i,1)} ${unit} per 100 innovation</span>` : '';
    return `<div class="payrow"><span class="lbl">${r.label}</span>
      <span>spent <b class="spend i">${costText(r.cost)}</b></span><span class="arrow">→</span>
      ${r.gain>0.05
        ? `<span>in exchange <b class="spend g">+${fmt(r.gain,1)} ${unit}</b>${badge(r.cost, r.gain, unit, !!r.direct)}</span>`
        : `<span><b class="spend z">not contributing to ${unit}</b>${badge(r.cost, r.gain, unit, !!r.direct)}</span>`}${per}</div>`;
  }).join('') + (D.pay.dataset.note ? `<p class="hint">${D.pay.dataset.note}</p>` : '');
}
/* ---------- Claude's verdict badges ----------
   Exchange rate from what each point costs in workers, mid-to-late game:
   1 admin ≈ 1.4 knowledge ≈ 1.9 innovation (labs end up cheapest, admin dearest). */
const XR = {innovation:1, knowledge:1.4, admin:1.9};
function badge(cost, gain, unit, direct=false){
  const costV = (cost.i||0)*XR.innovation + (cost.k||0)*XR.knowledge;
  if(!costV) return '';
  const gainV = Math.max(0,gain)*XR[unit], r = gainV/costV;
  const cls = gain<=0.05 ? 'r' : r>=1.25 ? 'g' : r>=0.8 ? 'o' : 'r';
  const head = {g:'Claude thinks this is worth it.', o:'Claude thinks this might be worth it.', r:"Claude thinks this isn't worth it."}[cls];
  const costIn = costText(cost);
  const assume = direct ? `It costs ${costIn}` : `Assuming you've researched this purely to get more ${unit} (a big assumption), it costs ${costIn}`;
  const why = gain<=0.05
    ? `${assume} and adds nothing at your current settings.`
    : `${assume} and adds ${fmt(gain,1)} ${unit}. At about 1 admin ≈ 1.4 knowledge ≈ 1.9 innovation, the return is ${fmt(r,2)}×.`;
  const tail = cls==='o' ? ' A close call: it comes down to which you are shorter of.' : '';
  const tip = `<b class="h ${cls}">${head}</b>${why}${tail}<small>The rate is what each point costs in workers once labs, libraries and admin are well researched. Nobles pull it towards 1 : 1 : 1.</small>`;
  return `<span class="vb ${cls}" tabindex="0" role="img" aria-label="${head}" data-tip="${tip.replace(/"/g,'&quot;')}">i</span>`;
}
{ // one floating tooltip for every badge: hover or focus on desktop, tap on touch
  const tip = document.createElement('div'); tip.className='vtip'; tip.hidden=true; document.body.appendChild(tip);
  let pinned=null;
  const show = b => {
    tip.innerHTML=b.dataset.tip; tip.hidden=false;
    const r=b.getBoundingClientRect(), w=tip.offsetWidth, h=tip.offsetHeight;
    let x=clamp(r.left+r.width/2-w/2, 12, innerWidth-w-12), y=r.top-h-8;
    if(y<8) y=r.bottom+8;
    tip.style.left=x+'px'; tip.style.top=y+'px';
  };
  const hide = () => { tip.hidden=true; pinned=null; };
  document.addEventListener('mouseover', e=>{ const b=e.target.closest('.vb, .tipped'); if(b && !matchMedia('(hover: none)').matches) show(b); });
  document.addEventListener('mouseout', e=>{ const b=e.target.closest('.vb, .tipped'); if(b && !pinned) tip.hidden=true; });
  document.addEventListener('focusin', e=>{ const b=e.target.closest('.vb, .tipped'); if(b) show(b); });
  document.addEventListener('focusout', e=>{ if(e.target.closest('.vb, .tipped')) hide(); });
  document.addEventListener('click', e=>{ const b=e.target.closest('.vb'); if(b){ if(pinned===b) hide(); else { pinned=b; show(b); } } else if(pinned) hide(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') hide(); });
  addEventListener('scroll', ()=>{ if(!tip.hidden) hide(); }, {passive:true});
}

const addCost = (...cs) => cs.reduce((a,c)=>({i:a.i+(c.i||0), k:a.k+(c.k||0)}), {i:0,k:0});

/* =====================================================================
   LEATHER -> LIBRARIES
   ===================================================================== */
const HUNT_P = techPath([
  {name:'Hunting', lv:8, ov:'tech0', eff:'+50% hunter output', cost:[4,8,12,16,20,24,28,32], add:0.5},
]);
const AUR_P = techPath([
  {name:'Basic Auroch breeding',          lv:7,  ov:'tech0',  eff:'+15% output',          cost:[4],  add:0.15},
  {name:'Auroch breeding Tools',          lv:2,  ov:'tools',  eff:'+1 tool slot (+25%)',  cost:[6],  add:0.25},
  {name:'Skilled Auroch breeding',        lv:10, ov:'tech1',  eff:'+15% output',          cost:[9],  add:0.15},
  {name:'Proficient Auroch breeding',     lv:7,  ov:'tech2',  eff:'+15% output',          cost:[15], add:0.15},
  {name:'Advanced Auroch breeding Tools', lv:2,  ov:'tools2', eff:'+1 tool slot (+25%)',  cost:[22], add:0.25},
  {name:'Expert Auroch breeding',         lv:10, ov:'tech3',  eff:'+16% output',          cost:[21], add:0.16},
]);

const LS = loadState('claypit-leather', {
  W:400, rLib:1, rHun:1, rPas:1, climate:'temperate', lo:0.10, n0:0, libUp:false, kH:0, kA:0,
  nLib:{on:false,gran:false,count:1,rank:0}, nPas:{on:false,gran:false,count:1,rank:0},
});

LS.n0 = 0; // no separate meat hunters: the leather hunters are the only ones

function leatherModel(L){
  const ed=S.ed, W=L.W, o=L.lo;
  const libS = l => (1 + (L.libUp?0.5:0) + 3*clamp((l-50)/950,0,1) + nobleAdd(L.nLib,l)) * L.rLib;
  const hunBase = (1 + HUNT_P.add[L.kH]) * L.rHun * (L.climate==='cold'?1.2:1);
  const hEff = N => N<=15 ? 1 : 1/(1+(N-15)/60);
  const hunLeather = h => h*1.4*hunBase*hEff(L.n0+h);
  const aurMul = L.climate==='temperate' ? 1.25 : 0.75;
  const aurRate = a => 0.56*(1 + AUR_P.add[L.kA] + clamp((a-50)/950,0,1) + nobleAdd(L.nPas,a)) * L.rPas * aurMul;
  const ev = (h,a) => {
    const haul = (h+a)>0 ? Math.ceil(o*(h+a)-1e-9) : 0, l = W-h-a-haul;
    if(l<=0 || h<0 || a<0) return null;
    const s=libS(l), hl=hunLeather(h), al=a*aurRate(a), supply=hl+al, demand=l*0.5*2*s;
    const f = demand>0 ? Math.min(1, supply/demand) : 0;
    return {h,a,haul,l,s,hl,al,supply,demand,f,out:ed*l*s*(1+f)};
  };
  const maxA = h => { let a=Math.max(0,Math.floor((W-h*(1+o)-1)/(1+o))+2); while(a>0 && !ev(h,a)) a--; return ev(h,a)?a:-1; };
  // For a given hunter count the best auroch count is 0 or the smallest count that fills every library.
  const bestA = (h, allowA=true) => {
    const z=ev(h,0); if(!z) return null;
    if(!allowA || z.f>=1) return z;
    const top=maxA(h); if(top<=0) return z;
    let cand=[z];
    if(ev(h,top).f<1) cand.push(ev(h,top));
    else { let lo=0, hi=top; while(lo<hi){ const m=(lo+hi)>>1; if(ev(h,m).f>=1) hi=m; else lo=m+1; } cand.push(ev(h,lo)); if(lo>0) cand.push(ev(h,lo-1)); }
    return cand.reduce((b,r)=>r.out>b.out?r:b);
  };
  const solve = ({hunt=true, aur=true}={}) => {
    let best=null;
    for(let h=0; h<=(hunt?W:0); h++){
      const r=bestA(h, aur); if(!r) break;
      if(!best || r.out>best.out+1e-9) best=r;
    }
    return best;
  };
  return {ev, solve, libS, hunBase, hEff, hunLeather, aurRate, aurMul};
}

const LD = buildTab('leather', {
  sliders:[{key:'hunt',title:'Hunter tech',sub:'Husbandry tree, paid in innovation'},{key:'aur',title:'Auroch pen tech',sub:'Husbandry tree, paid in innovation'}],
  moreHint:'Extra knowledge from researching more, at your current settings, with the workforce re-split for the new tech. The cost stays tied up for as long as you keep the tech. You decide whether the knowledge is worth the innovation.',
  notes:[
    '<b>Knowledge is a standing total</b>, like innovation: the libraries hold it at a level set by their workers, and tech costs are held out of it for as long as you keep the tech. So Advanced Library (100 knowledge) is worth it exactly when it adds more than 100, and the calculator applies it when it does.',
    '<b>Library output per worker</b> = (1 + Advanced Library [+50%] + experience + noble) × race. Leather in stock doubles the room (×2).',
    '<b>Leather burned</b> = 0.5 per librarian per day × that worker\'s full output, including the ×2. So while leather is short, each leather adds exactly 1 knowledge (× education).',
    '<b>Hunter</b>: 1.4 leather per worker per day × (1 + 50% per Hunting level) × race × 1.2 in cold climates. Hunting meat makes 2.2 meat instead. <b>Soft cap</b>: once your city has more than 15 hunters, every hunter is scaled by 1 / (1 + (hunters − 15) / 60). The calculator treats the leather hunters as your only hunters. Hunters have no tools, noble office or experience bonus. The game\'s yearly "luck" (×0.6 to ×1.4) averages out and is left out.',
    '<b>Auroch pen</b>: 0.56 leather and 0.56 meat per worker per day (plus a little livestock) × (1 + tech + tools + experience + noble) × race × 1.25 in temperate climates (×0.75 in cold or hot). No cap. Assumes pens are fully stocked and sized for their workers.',
    '<b>Experience</b>: libraries gain up to +300% as librarians rise from 50 to 1,000. Auroch pens gain up to +100% from 50 to 1,000.',
    '<b>Education</b> (×1 to ×2) multiplies the city\'s knowledge, so it doesn\'t burn more leather. <b>Haulers</b> = (hunters + auroch hands) × logistics overhead, rounded up.',
    '<b>ⓘ verdicts</b> convert costs and gains at about 1 admin ≈ 1.4 knowledge ≈ 1.9 innovation: what each point costs in workers once the rooms are well researched. Green is 1.25× or better, orange 0.8–1.25×, red below 0.8×.',
    '<b>Not modelled</b>: room layout efficiency, degradation, pasture irrigation and weather, tool wear, building costs, and flat bonuses such as city rank (they add the same with or without leather, so they do not change the answer, but the percentages leave them out).',
  ],
});

{
  const on = ()=>leatherUpdate();
  addRange(LD.ctl, {id:'lw', icon:'library', label:'Workforce to assign', primary:true, wf:true, get:()=>LS.W, set:v=>LS.W=v, show:v=>fmt(v), ends:['10','400','2,000'], onChange:on});
  addRange(LD.ctl, {id:'lrl', icon:'library', label:'Library race bonus', min:0.6, max:1.25, step:0.01, get:()=>LS.rLib, set:v=>LS.rLib=v, show:v=>'×'+v.toFixed(2), ends:['×0.60 Garthimi','Human ×1.25'], onChange:on});
  addRange(LD.ctl, {id:'lrh', icon:'hunter', label:'Hunter race bonus', min:1, max:1.2, step:0.01, get:()=>LS.rHun, set:v=>LS.rHun=v, show:v=>'×'+v.toFixed(2), ends:['×1.00 most races','Garthimi, Tilapi ×1.20'], onChange:on});
  addRange(LD.ctl, {id:'lrp', icon:'auroch', label:'Auroch pen race bonus', min:0.75, max:1.2, step:0.01, get:()=>LS.rPas, set:v=>LS.rPas=v, show:v=>'×'+v.toFixed(2), ends:['×0.75 Garthimi','Tilapi ×1.20'], onChange:on});
  { // climate: the game's own climate icons, hover for what each does
    const CL = {
      cold:      {name:'Cold',      hun:'×1.2',  aur:'×0.75'},
      temperate: {name:'Temperate', hun:'×1.0',  aur:'×1.25'},
      hot:       {name:'Hot',       hun:'×1.0',  aur:'×0.75'},
    };
    const box = el(`<div class="ctl"><div class="ctl-head"><img class="px" src="${IC['cl_'+LS.climate]}" alt="" id="lclim-ic"><label>Climate</label><output id="lclim-o"></output></div>
      <div class="climico" role="group" aria-label="Climate">${Object.entries(CL).map(([k,c])=>`<button type="button" class="tipped" data-c="${k}" aria-label="${c.name}"
        data-tip="<b class=&quot;h&quot;>${c.name}</b>Hunters ${c.hun}. Auroch pens ${c.aur}.<small>Only hunters and auroch pens react to climate. Libraries, labs, admin and the other producers don't.</small>"><img src="${IC['cl_'+k]}" alt=""></button>`).join('')}</div></div>`);
    LD.ctl.appendChild(box);
    const mark=()=>{ box.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.c===LS.climate)); box.querySelector('#lclim-o').textContent=CL[LS.climate].name; box.querySelector('#lclim-ic').src=IC['cl_'+LS.climate]; };
    box.querySelectorAll('button').forEach(b=>b.onclick=()=>{ LS.climate=b.dataset.c; mark(); on(); });
    mark();
  }
  addRange(LD.ctl, {id:'llo', icon:'cart', label:'Logistics overhead', min:0, max:50, step:1, scale:100, get:()=>LS.lo, set:v=>LS.lo=v, show:v=>Math.round(v*100)+'%', ends:['0%','50% extra haulers per producer'], onChange:on});
  addNoble(LD.ctl, 'lnb-lib', LS.nLib, 'library', 'Master of Libraries', 'librarians', on);
  addNoble(LD.ctl, 'lnb-pas', LS.nPas, 'auroch', 'Master of Auroch pens', 'auroch hands', on);
  LD.huntS = slider('leather-ts-hunt', HUNT_P, {label:'Hunter tech level', fg:'hunter', set:k=>LS.kH=k, onChange:on, none:'No Hunting tech', bonusLabel:'Hunter bonus from tech', bonus:k=>'+'+fmt(HUNT_P.add[k]*100)+'%', earn:()=>({v:LD.earn.hunt, unit:'knowledge'})});
  LD.aurS = slider('leather-ts-aur', AUR_P, {label:'Auroch pen tech level', fg:'auroch', bg:'bgpasture', set:k=>LS.kA=k, onChange:on, none:'No auroch tech', bonusLabel:'Auroch bonus from tech', bonus:k=>'+'+fmt(AUR_P.add[k]*100)+'%', earn:()=>({v:LD.earn.aur, unit:'knowledge'})});
}

/* Advanced Library costs 100 knowledge and pays back in knowledge, so it is worth it
   exactly when it adds more than 100. The calculator decides it and applies it. */
const LIB_UP_COST = 100;
const libUpGain = st => leatherModel(Object.assign({}, st, {libUp:true})).solve().out - leatherModel(Object.assign({}, st, {libUp:false})).solve().out;
function libUpAdvice(){
  const g = libUpGain(LS), worth = g > LIB_UP_COST;
  let from = null;
  if(!worth && libUpGain(Object.assign({}, LS, {W:2000})) > LIB_UP_COST){
    let lo=LS.W, hi=2000;                       // smallest workforce where it pays
    while(hi-lo>5){ const m=Math.round((lo+hi)/2); if(libUpGain(Object.assign({}, LS, {W:m}))>LIB_UP_COST) hi=m; else lo=m; }
    const r = leatherModel(Object.assign({}, LS, {W:hi, libUp:true})).solve();
    from = {W:hi, l:r.l};
  }
  return {g, worth, from};
}
function drawLibAdvice(a){
  const body = a.worth
    ? `<b style="color:var(--good)">Research it.</b> It adds <b class="num">+${fmt(a.g,1)}</b> knowledge for its ${LIB_UP_COST}, so you come out <b class="num">${fmt(a.g-LIB_UP_COST,1)}</b> ahead. The results below include it.`
    : `<b style="color:var(--bad)">Not yet.</b> It adds only <b class="num">+${fmt(a.g,1)}</b> knowledge, less than its ${LIB_UP_COST} cost. ` +
      (a.from ? `At these settings it pays once you assign about <b class="num">${fmt(a.from.W)}</b> workers (about <b class="num">${fmt(a.from.l)}</b> librarians).`
              : `At these settings it doesn't pay even with 2,000 workers.`) + ` The results below leave it out.`;
  LD.tgl.innerHTML = `<div class="advice ${a.worth?'yes':'no'}">${ticon('library','up1')}<div><div class="nm">Advanced Library <span class="muted">· library upgrade, +50% · ${LIB_UP_COST} knowledge</span></div><div class="meta">${body}</div></div></div>`;
}

function leatherUpdate(){
  if(ACTIVE!=='leather') return;
  const adv = libUpAdvice(); LS.libUp = adv.worth; drawLibAdvice(adv);
  const M = leatherModel(LS);
  const none = M.ev(0,0), best = M.solve(), huntOnly = M.solve({aur:false}), aurOnly = M.solve({hunt:false});
  const gain = best.out-none.out, yes = (best.h+best.a)>0 && gain>0.05;
  const use = yes ? best : none, ed=S.ed;

  if(yes){
    const src = [best.h?`<b>${fmt(best.h)}</b> hunter${best.h>1?'s':''}`:'', best.a?`<b>${fmt(best.a)}</b> on auroch pens`:''].filter(Boolean).join(' and ');
    renderVerdictBox(LD, true, 'Burn leather', `<span class="num">+${fmt(gain)}</span> knowledge <span class="muted" style="font-size:1rem">(${pct(gain/none.out)} over all libraries)</span>`,
      `Put ${src}${best.haul?`, <b>${fmt(best.haul)}</b> hauling`:''}, and <b>${fmt(best.l)}</b> in libraries. Leather covers ${fmt(best.f*100,0)}% of what the libraries could burn.`);
  } else {
    renderVerdictBox(LD, false, 'Skip leather', `Put all <span class="num">${fmt(LS.W)}</span> workers in libraries`,
      `No mix of hunters and auroch pens beats running the libraries without leather. All libraries gives <b class="num">${fmt(none.out)}</b> knowledge.`);
  }
  drawAlloc(LD, [
    {ic:'library', label:'Libraries', n:use.l, color:SEG.room},
    {ic:'hunter', label:'Hunters', n:use.h, color:SEG.p1},
    {ic:'auroch', label:'Auroch pens', n:use.a, color:SEG.p2},
    {ic:'cart', label:'Haulers', n:use.haul, color:SEG.haul},
  ]);
  if(ACTIVE==='leather') setMbar(yes, 'leather', yes?'+'+fmt(gain)+' knowledge':fmt(none.out)+' knowledge',
    [['library',use.l],['hunter',use.h],['auroch',use.a],['cart',use.haul]]);

  const lw = use.l, s = M.libS(lw);
  const hPer = best.h ? best.hl/best.h : M.hunLeather(1);
  const aPer = M.aurRate(Math.max(best.a,1));
  drawTiles(LD, [
    ['Librarian, no leather', fmt(ed*s,2), 'knowledge each'],
    ['Librarian, with leather', fmt(2*ed*s,2), `burns ${fmt(s,2)} leather/day`],
    ['Hunter', fmt(hPer,2), `leather/day${(LS.n0+Math.max(best.h,1))>15?' (past the soft cap)':''}`],
    ['Auroch hand', fmt(aPer,2), `leather + ${fmt(aPer,2)} meat/day`],
  ]);

  // by-products and opportunity cost
  const rows=[];
  if(use.h>0){
    const forgone = use.h*2.2*M.hunBase*M.hEff(use.h);   // what these hunters would make on the meat recipe
    rows.push(`<div class="row minus"><img class="px" src="${IC.hunter}" alt=""><span class="t">By having your hunters supply the libraries, you are missing out on ${fmt(forgone,1)} meat per day.</span><span class="v">−${fmt(forgone,1)}/day</span></div>`);
  }
  if(use.a>0){
    const meat=use.al, stock=use.al*0.0875/0.56;
    rows.push(`<div class="row plus"><img class="px" src="${IC.meat}" alt=""><span class="t">As a bonus, this distribution nets you ${fmt(meat,1)} meat per day.<small>Plus about ${fmt(stock,1)} livestock a day from the auroch pens.</small></span><span class="v">+${fmt(meat,1)}/day</span></div>`);
  }
  LD.byp.innerHTML = rows.join('');

  const cols=['Option','Libraries','Hunters','Auroch hands','Haulers','Knowledge','vs all libraries'];
  const opts=[['All libraries, no leather',none],['Hunters only',huntOnly],['Auroch pens only',aurOnly]];
  if(best!==huntOnly && best!==aurOnly && best.h && best.a) opts.push(['Best mix',best]);
  const top=Math.max(...opts.map(o=>o[1].out));
  drawTable(LD.cmp, cols, opts.map(([n,r])=>({best:Math.abs(r.out-top)<1e-6, cells:[n,fmt(r.l),fmt(r.h),fmt(r.a),fmt(r.haul),fmt(r.out),r===none?'–':pct(r.out/none.out-1)]})));

  // what more research buys
  const more=[], base=best.out;
  const tryState = (name, patch, cost) => {
    const st=Object.assign({}, LS, patch); const r=leatherModel(st).solve(); const g=r.out-base;
    const c = (cost.i||0)+(cost.k||0);
    more.push({cells:[name, costText(cost)+badge(cost, g, 'knowledge'), (g>=0.05?'+':'')+fmt(g,1), c&&g>0.05&&!(cost.i&&cost.k)?fmt(100*g/c,1):'–']});
  };
  if(LS.kH<HUNT_P.N){ tryState(`Next level: Hunting ${LS.kH+1}/8`, {kH:LS.kH+1}, costBetween(HUNT_P,LS.kH,LS.kH+1));
    if(LS.kH<HUNT_P.N-1) tryState('Hunting to 8/8', {kH:HUNT_P.N}, costBetween(HUNT_P,LS.kH,HUNT_P.N)); }
  if(LS.kA<AUR_P.N){ tryState(`Next level: ${techAt(AUR_P.steps,AUR_P.techs,LS.kA+1).label}`, {kA:LS.kA+1}, costBetween(AUR_P,LS.kA,LS.kA+1));
    const k5=Math.min(AUR_P.N,LS.kA+5); if(k5>LS.kA+1) tryState(`5 more auroch levels`, {kA:k5}, costBetween(AUR_P,LS.kA,k5));
    if(AUR_P.N>k5) tryState('Auroch tree to the end', {kA:AUR_P.N}, costBetween(AUR_P,LS.kA,AUR_P.N)); }
  drawTable(LD.more, ['Research','Cost','Knowledge gained','Per 100 spent'], more.length?more:[{cells:['Everything relevant is researched','–','–','–']}]);

  // payback of the leather techs: current result minus the result without that tree
  const without = patch => leatherModel(Object.assign({}, LS, patch)).solve().out;
  LD.earn.hunt = LS.kH ? best.out - without({kH:0}) : 0;
  LD.earn.aur  = LS.kA ? best.out - without({kA:0}) : 0;

  LD.huntS.draw(LS.kH); LD.aurS.draw(LS.kA);
  saveState('claypit-leather', LS);
}
MODULES.leather = leatherUpdate;

/* =====================================================================
   PAPER -> ADMIN
   ===================================================================== */
// Admin tree branches (tools and efficiency both hang off Paper Filing). Ordered by value per knowledge:
// Efficiency 1 (10), Tools 1 (80), Tools 2 (100), then Efficiency 2-5 (60, 110, 160, 210).
const ADM_P = techPath([
  {name:'Administration Efficiency', lv:1, first:1, of:5, ov:'tech0', eff:'+10% output',         cost:[10],  add:0.10, cur:'knowledge'},
  {name:'Admin tools',               lv:1, first:1, of:2, ov:'tools', eff:'+1 tool slot (+25%)', cost:[80],  add:0.25, cur:'knowledge'},
  {name:'Admin tools',               lv:1, first:2, of:2, ov:'tools', eff:'+1 tool slot (+25%)', cost:[100], add:0.25, cur:'knowledge'},
  {name:'Administration Efficiency', lv:4, first:2, of:5, ov:'tech0', eff:'+10% output',         cost:[60,110,160,210], add:0.10, cur:'knowledge'},
]);
const PAP_P = techPath([
  {name:'The Papermaker',              lv:1,  ov:'up1',    eff:'Unlocks the paper workshop',   cost:[15], add:0},
  {name:'Basic Paper making',          lv:5,  ov:'tech0',  eff:'+15% output',                  cost:[4],  add:0.15},
  {name:'Paper making Tools',          lv:4,  ov:'tools',  eff:'+1 tool slot (+25%)',          cost:[5],  add:0.25},
  {name:'Skilled Paper making',        lv:10, ov:'tech1',  eff:'+15% output',                  cost:[9],  add:0.15},
  {name:'Proficient Paper making',     lv:5,  ov:'tech2',  eff:'+15% output',                  cost:[15], add:0.15},
  {name:'Advanced Paper making Tools', lv:4,  ov:'tools2', eff:'+1 tool slot (+25%)',          cost:[19], add:0.25},
  {name:'Expert Paper making',         lv:10, ov:'tech3',  eff:'+15% output',                  cost:[19], add:0.15},
  {name:'Paper Excellence',            lv:4,  ov:'up2',    eff:'Wood use ÷ (1 + 0.1 per level)', cost:[35], add:0, cur:'knowledge', kind:'con'},
]);
const PAP_CON = [0]; PAP_P.steps.forEach((s,i)=>PAP_CON.push(PAP_CON[i]+(s.kind==='con'?1:0)));
const WOOD_P = techPath([
  {name:'Basic woodcutting',          lv:7,  ov:'tech0',  eff:'+15% output',         cost:[4],   add:0.15},
  {name:'woodcutting Tools',          lv:2,  ov:'tools',  eff:'+1 tool slot (+25%)', cost:[6],   add:0.25},
  {name:'Skilled woodcutting',        lv:10, ov:'tech1',  eff:'+15% output',         cost:[9],   add:0.15},
  {name:'Proficient woodcutting',     lv:7,  ov:'tech2',  eff:'+15% output',         cost:[15],  add:0.15},
  {name:'Advanced woodcutting Tools', lv:2,  ov:'tools2', eff:'+1 tool slot (+25%)', cost:[22],  add:0.25},
  {name:'Expert woodcutting',         lv:4,  ov:'tech3',  eff:'+21% output',         cost:[21],  add:0.21},
  {name:'Advanced Woodcutter',        lv:1,  ov:'up2',    eff:'Upgrade (+100%)',     cost:[126], add:1.0},
]);

const PS = loadState('claypit-paper', {
  W:400, rAdm:1, rWs:1, rWood:1, lo:0.10, kAdm:0, paperTech:false, kPap:1, kWood:0,
  nAdm:{on:false,gran:false,count:1,rank:0}, nWs:{on:false,gran:false,count:1,rank:0}, nWood:{on:false,gran:false,count:1,rank:0},
});

PS.rWs = clamp(PS.rWs, 0.75, 1.2); PS.rWood = clamp(PS.rWood, 1, 1.4);

function paperModel(P){
  const ed=S.ed, W=P.W, o=P.lo, cb=P.paperTech?1.25:1;
  const admS = n => (1 + ADM_P.add[P.kAdm] + 1.0*clamp((n-50)/950,0,1) + nobleAdd(P.nAdm,n)) * P.rAdm;
  const canPaper = P.kPap>0;
  const paperRate = p => 0.75*(1 + PAP_P.add[P.kPap] + clamp((p-50)/950,0,1) + nobleAdd(P.nWs,p)) * P.rWs;
  const woodPerPaper = (2/0.75)/(1+0.1*PAP_CON[P.kPap]);
  const woodRate = w => 4*(1 + WOOD_P.add[P.kWood] + clamp((w-50)/950,0,1) + nobleAdd(P.nWood,w)) * P.rWood;
  const cutters = wood => {
    if(wood<=0) return 0;
    let w=Math.max(1,Math.ceil(wood/woodRate(1)));
    for(let i=0;i<4;i++) w=Math.max(1,Math.ceil(wood/woodRate(w)));
    while(w>1 && (w-1)*woodRate(w-1)>=wood) w--;
    while(w*woodRate(w)<wood) w++;
    return w;
  };
  const ev = p => {
    const paper = p>0 ? p*paperRate(p) : 0, wood = paper*woodPerPaper, w = cutters(wood);
    const haul = (p+w)>0 ? Math.ceil(o*(p+w)-1e-9) : 0, n = W-p-w-haul;
    if(n<=0) return null;
    const s=admS(n), demand=n*1*3*s/cb, f=demand>0?Math.min(1,paper/demand):0;
    return {p,w,haul,n,s,paper,wood,demand,f,out:ed*n*s*(1+2*f)};
  };
  const solve = () => {
    let best=ev(0);
    if(canPaper) for(let p=1;p<=W;p++){ const r=ev(p); if(!r) break; if(r.out>best.out+1e-9) best=r; if(r.f>=1 && r.out<best.out-1) break; }
    return best;
  };
  return {ev, solve, admS, paperRate, woodRate, woodPerPaper, cb};
}

const PD = buildTab('paper', {
  sliders:[{key:'adm',title:'Administration tech',sub:'Science tree, paid in knowledge'},{key:'pap',title:'Paper workshop tech',sub:'Workshop tree, paid in innovation (Paper Excellence in knowledge)'},{key:'wood',title:'Woodcutter tech',sub:'Mines tree, paid in innovation'}],
  moreHint:'Extra admin from researching more, at your current settings, with the workforce re-split for the new tech. The cost stays tied up for as long as you keep the tech. You decide whether the admin is worth the innovation or knowledge.',
  notes:[
    '<b>Admin is a standing total</b>, like innovation and knowledge: the admin rooms hold it at a level set by their workers. Tech costs are held out of your innovation or knowledge for as long as you keep the tech.',
    '<b>Admin output per worker</b> = (1 + tools [+25% per level] + Administration Efficiency [+10% per level] + experience + noble) × race. Paper in stock triples the room (×3).',
    '<b>Paper burned</b> = 1 per admin worker per day × that worker\'s full output, including the ×3, divided by 1.25 with Paper Handling. While paper is short, each paper adds 2/3 admin (5/6 with Paper Handling), × education.',
    '<b>Admin tech slider order</b>: tools and efficiency are separate branches, so the slider uses the best order per knowledge spent: Efficiency 1, Tools 1, Tools 2, then Efficiency 2–5. Paper Handling (200 knowledge) is the tick box.',
    '<b>Paper workshop</b>: 0.75 paper per worker per day × (1 + tech + tools + experience + noble) × race, from 2 wood per 0.75 paper (2.67 wood per paper, divided by 1 + 0.1 per Paper Excellence level, so −29% at level 4). Workshops hold 8 tools, so full tools add +200%.',
    '<b>Woodcutter</b>: 4 wood per worker per day × (1 + tech + tools + upgrade + experience + noble) × race. Only as many woodcutters as the paper needs are used. Assumes enough forest, normal weather and no irrigation.',
    '<b>Experience</b>: admin, paper workshops and woodcutters each gain up to +100% as their workers rise from 50 to 1,000.',
    '<b>Education</b> (×1 to ×2) multiplies the city\'s admin, so it doesn\'t burn more paper. <b>Haulers</b> = (paper workers + woodcutters) × logistics overhead, rounded up.',
    '<b>ⓘ verdicts</b> convert costs and gains at about 1 admin ≈ 1.4 knowledge ≈ 1.9 innovation: what each point costs in workers once the rooms are well researched. Green is 1.25× or better, orange 0.8–1.25×, red below 0.8×. Admin tech gets no "Assuming…" line because it only ever produces admin.',
    '<b>Not modelled</b>: room layout efficiency, degradation, tool wear, building costs, selling spare wood or paper, and flat bonuses such as city rank (they add the same with or without paper, so they do not change the answer, but the percentages leave them out).',
  ],
});

{
  const on = ()=>paperUpdate();
  addRange(PD.ctl, {id:'pw', icon:'admin', label:'Workforce to assign', primary:true, wf:true, get:()=>PS.W, set:v=>PS.W=v, show:v=>fmt(v), ends:['10','400','2,000'], onChange:on});
  addRange(PD.ctl, {id:'pra', icon:'admin', label:'Admin race bonus', min:0.6, max:1.25, step:0.01, get:()=>PS.rAdm, set:v=>PS.rAdm=v, show:v=>'×'+v.toFixed(2), ends:['×0.60 Garthimi','Human ×1.25'], onChange:on});
  addRange(PD.ctl, {id:'prs', icon:'paperws', label:'Paper workshop race bonus', min:0.75, max:1.2, step:0.01, get:()=>PS.rWs, set:v=>PS.rWs=v, show:v=>'×'+v.toFixed(2), ends:['×0.75 Garthimi','Dondorian ×1.20'], onChange:on});
  addRange(PD.ctl, {id:'prw', icon:'woodcutter', label:'Woodcutter race bonus', min:1, max:1.4, step:0.01, get:()=>PS.rWood, set:v=>PS.rWood=v, show:v=>'×'+v.toFixed(2), ends:['×1.00 most races','Tilapi ×1.40'], onChange:on});
  addRange(PD.ctl, {id:'plo', icon:'cart', label:'Logistics overhead', min:0, max:50, step:1, scale:100, get:()=>PS.lo, set:v=>PS.lo=v, show:v=>Math.round(v*100)+'%', ends:['0%','50% extra haulers per producer'], onChange:on});
  addNoble(PD.ctl, 'pnb-adm', PS.nAdm, 'admin', 'Master of Administration', 'admin workers', on);
  addNoble(PD.ctl, 'pnb-ws', PS.nWs, 'paperws', 'Master of Paper workshops', 'paper workers', on);
  addNoble(PD.ctl, 'pnb-wood', PS.nWood, 'woodcutter', 'Master of Woodcutters', 'woodcutters', on);
  addToggle(PD.tgl, {id:'pptech', fg:'admin', ov:'tech1', name:'Paper Handling', meta:'Admin uses 20% less paper (÷1.25) · 200 knowledge', get:()=>PS.paperTech, set:v=>PS.paperTech=v, onChange:on});
  PD.admS = slider('paper-ts-adm', ADM_P, {direct:true, label:'Administration tech level', fg:'admin', set:k=>PS.kAdm=k, onChange:on, none:'No admin tech', noneMeta:'Paper Filing only', bonusLabel:'Admin bonus from tech', bonus:k=>'+'+fmt(ADM_P.add[k]*100)+'%', earn:()=>({v:PD.earn.adm, unit:'admin'})});
  PD.papS = slider('paper-ts-pap', PAP_P, {label:'Paper workshop tech level', fg:'paperws', set:k=>PS.kPap=k, onChange:on, none:'No paper workshop', noneMeta:'Research The Papermaker to make paper', bonusLabel:'Paper bonus from tech', bonus:k=>'+'+fmt(PAP_P.add[k]*100)+'%'+(PAP_CON[k]?`, wood −${fmt(100-100/(1+0.1*PAP_CON[k]))}%`:''), earn:()=>({v:PD.earn.pap, unit:'admin'})});
  PD.woodS = slider('paper-ts-wood', WOOD_P, {label:'Woodcutter tech level', fg:'woodcutter', set:k=>PS.kWood=k, onChange:on, none:'No woodcutting tech', bonusLabel:'Woodcutter bonus from tech', bonus:k=>'+'+fmt(WOOD_P.add[k]*100)+'%', earn:()=>({v:PD.earn.wood, unit:'admin'})});
}

function paperUpdate(){
  if(ACTIVE!=='paper') return;
  const M = paperModel(PS);
  const none = M.ev(0), best = M.solve();
  const gain = best.out-none.out, yes = best.p>0 && gain>0.05;
  const use = yes ? best : none, ed=S.ed;

  if(PS.kPap===0){
    renderVerdictBox(PD, false, 'No paper yet', `Put all <span class="num">${fmt(PS.W)}</span> workers in admin`,
      `You can't make paper until you research The Papermaker (15 innovation). Move the paper workshop slider to see whether paper would pay.`);
  } else if(yes){
    renderVerdictBox(PD, true, 'Burn paper', `<span class="num">+${fmt(gain)}</span> admin <span class="muted" style="font-size:1rem">(${pct(gain/none.out)} over all admin)</span>`,
      `Put <b>${fmt(best.p)}</b> in paper workshops, <b>${fmt(best.w)}</b> cutting wood${best.haul?`, <b>${fmt(best.haul)}</b> hauling`:''}, and <b>${fmt(best.n)}</b> in administration. Paper covers ${fmt(best.f*100,0)}% of what admin could burn.`);
  } else {
    renderVerdictBox(PD, false, 'Skip paper', `Put all <span class="num">${fmt(PS.W)}</span> workers in admin`,
      `No amount of paper making (with the woodcutters it needs) beats running admin without paper. All admin gives <b class="num">${fmt(none.out)}</b> admin.`);
  }
  drawAlloc(PD, [
    {ic:'admin', label:'Admin', n:use.n, color:SEG.room},
    {ic:'paperws', label:'Paper workshops', n:use.p, color:SEG.p1},
    {ic:'woodcutter', label:'Woodcutters', n:use.w, color:SEG.p2},
    {ic:'cart', label:'Haulers', n:use.haul, color:SEG.haul},
  ]);
  if(ACTIVE==='paper') setMbar(yes, 'paper', yes?'+'+fmt(gain)+' admin':fmt(none.out)+' admin',
    [['admin',use.n],['paperws',use.p],['woodcutter',use.w],['cart',use.haul]]);

  const s=M.admS(use.n), pr=M.paperRate(Math.max(use.p,1)), wr=M.woodRate(Math.max(use.w,1));
  const workersPerPaper = (1+PS.lo)*(1/pr + M.woodPerPaper/wr);
  drawTiles(PD, [
    ['Admin worker, no paper', fmt(ed*s,2), 'admin each'],
    ['Admin worker, with paper', fmt(3*ed*s,2), `burns ${fmt(3*s/M.cb,2)} paper/day`],
    ['Paper worker', PS.kPap?fmt(pr,2):'–', PS.kPap?`paper/day from ${fmt(pr*M.woodPerPaper,1)} wood`:'not researched'],
    ['Workers per paper', PS.kPap?fmt(workersPerPaper,2):'–', `incl. ${fmt(M.woodPerPaper/wr,2)} woodcutters and hauling`],
  ]);
  PD.byp.innerHTML = PS.kPap ? `<div class="row"><img class="px" src="${IC.paper}" alt=""><span class="t">What one paper is worth<small>While admin is short of paper, each paper adds ${fmt(2*M.cb/3*ed,2)} admin. An admin worker makes ${fmt(ed*s,2)} on their own, against ${fmt(workersPerPaper,2)} workers to make one paper.</small></span><span class="v">${fmt(2*M.cb/3*ed/workersPerPaper,2)}<small class="muted" style="font-size:.7rem"> admin/worker</small></span></div>` : '';

  const cols=['Option','Admin','Paper workers','Woodcutters','Haulers','Admin output','vs all admin'];
  const opts=[['All admin, no paper',none]]; if(PS.kPap) opts.push(['Best with paper',best]);
  const top=Math.max(...opts.map(o=>o[1].out));
  drawTable(PD.cmp, cols, opts.map(([n,r])=>({best:Math.abs(r.out-top)<1e-6, cells:[n,fmt(r.n),fmt(r.p),fmt(r.w),fmt(r.haul),fmt(r.out),r===none?'–':pct(r.out/none.out-1)]})));

  const more=[], base=best.out;
  const tryState = (name, patch, cost, direct=false) => {
    const st=Object.assign({}, PS, patch); const r=paperModel(st).solve(); const g=r.out-base;
    const c=(cost.i||0)+(cost.k||0);
    more.push({cells:[name, costText(cost)+badge(cost, g, 'admin', direct), (g>=0.05?'+':'')+fmt(g,1), c&&g>0.05&&!(cost.i&&cost.k)?fmt(100*g/c,1):'–']});
  };
  const chain = (P, key, label, direct=false) => {
    const k=PS[key]; if(k>=P.N) return;
    tryState(`Next level: ${techAt(P.steps,P.techs,k+1).label}`, {[key]:k+1}, costBetween(P,k,k+1), direct);
    const k5=Math.min(P.N,k+5); if(k5>k+1) tryState(`5 more ${label} levels`, {[key]:k5}, costBetween(P,k,k5), direct);
    if(P.N>k5) tryState(`${label[0].toUpperCase()+label.slice(1)} tree to the end`, {[key]:P.N}, costBetween(P,k,P.N), direct);
  };
  if(!PS.paperTech) tryState('Paper Handling', {paperTech:true}, {k:200}, true);
  chain(ADM_P,'kAdm','admin',true);
  chain(PAP_P,'kPap','paper');
  chain(WOOD_P,'kWood','woodcutting');
  if(PS.kPap<PAP_P.N && PS.kWood<WOOD_P.N){
    const c1=costBetween(PAP_P,PS.kPap,PAP_P.N), c2=costBetween(WOOD_P,PS.kWood,WOOD_P.N);
    tryState('Paper and woodcutting trees both to the end', {kPap:PAP_P.N, kWood:WOOD_P.N}, {i:c1.i+c2.i, k:c1.k+c2.k});
  }
  drawTable(PD.more, ['Research','Cost','Admin gained','Per 100 spent'], more.length?more:[{cells:['Everything relevant is researched','–','–','–']}]);

  // payback of each tree: current result minus the result without it
  const without = patch => paperModel(Object.assign({}, PS, patch)).solve().out;
  PD.earn.adm  = PS.kAdm  ? best.out - without({kAdm:0})  : 0;
  PD.earn.pap  = PS.kPap  ? best.out - without({kPap:0})  : 0;
  PD.earn.wood = PS.kWood ? best.out - without({kWood:0}) : 0;

  PD.admS.draw(PS.kAdm); PD.papS.draw(PS.kPap); PD.woodS.draw(PS.kWood);
  saveState('claypit-paper', PS);
}
MODULES.paper = paperUpdate;

/* ---------- city-wide settings (above the tabs) ---------- */
{
  const ed=document.getElementById('ed'), edo=document.getElementById('ed-o');
  ed.oninput=()=>{ S.ed=+ed.value; edo.textContent='×'+S.ed.toFixed(2); save(); refreshActive(); };
}

/* ---------- race tooltips on every race-bonus slider ----------
   Multiplier: the race's ROOM_...>MUL boost. Fulfillment: the race's PREFERRED > WORK value,
   or the room's own FULFILLMENT default when the race doesn't list it (init/race, init/room). */
{
  const RACES = [ // [icon, name, multipliers, fulfillments]
    ['race_human',     'Human',     {lab:1.25,clay:1,   lib:1.25,adm:1.25,hun:1,  aur:1,   pap:1,   wood:1  }, {lab:2,   clay:-2, lib:2,   adm:.75,hun:.75,aur:0,   pap:.5, wood:-2 }],
    ['race_garthimi',  'Garthimi',  {lab:0.8, clay:1.25,lib:0.6, adm:0.6, hun:1.2,aur:0.75,pap:0.75,wood:1  }, {lab:.75, clay:0,  lib:.75, adm:.5, hun:4,  aur:-.5, pap:.5, wood:-1 }],
    ['race_cretonian', 'Cretonian', {lab:1,   clay:1,   lib:1,   adm:1,   hun:1,  aur:1,   pap:0.8, wood:1  }, {lab:.75, clay:0,  lib:.75, adm:.75,hun:-4, aur:0,   pap:.5, wood:-2 }],
    ['race_dondorian', 'Dondorian', {lab:1,   clay:1.15,lib:1,   adm:1,   hun:1,  aur:0.85,pap:1.2, wood:1  }, {lab:.5,  clay:-2, lib:.5,  adm:.75,hun:1,  aur:0,   pap:1,  wood:-2 }],
    ['race_amevia',    'Amevia',    {lab:1,   clay:1.2, lib:1,   adm:1,   hun:1,  aur:0.8, pap:1,   wood:1  }, {lab:1,   clay:.5, lib:.75, adm:.5, hun:.25,aur:0,   pap:.25,wood:-2 }],
    ['race_tilapi',    'Tilapi',    {lab:1,   clay:0.75,lib:1,   adm:1,   hun:1.2,aur:1.2, pap:1,   wood:1.4}, {lab:.75, clay:-10,lib:.75, adm:.5, hun:3,  aur:1.25,pap:.5, wood:.25}],
  ];
  const JOBS = {rl:['lab','Laboratory'], rm:['clay','Claypit'], lrl:['lib','Library'], lrh:['hun','Hunter'],
                lrp:['aur','Auroch pen'], pra:['adm','Administration'], prs:['pap','Paper workshop'], prw:['wood','Woodcutter']};
  for(const [id,[k,job]] of Object.entries(JOBS)){
    const inp=document.getElementById(id); if(!inp) continue;
    const head=inp.closest('.ctl').querySelector('.ctl-head'), lab=head.querySelector('label');
    const rows=[...RACES].sort((a,b)=>b[2][k]-a[2][k] || b[3][k]-a[3][k]).map(([ic,name,m,f])=>
      `<span class="rrow"><img class="px" src="${IC[ic]}" alt=""><span class="rn">${name}:</span><span class="rm">×${m[k].toFixed(2)}</span><span class="rf ${f[k]<0?'neg':''}">(${Math.round(f[k]*100)}%)</span></span>`).join('');
    const tip=`<b class="h">${job}: race bonuses</b>${rows}<span class="rrow rkey"><span class="ricon"></span><span class="rn">Race:</span><span class="rm">×Multiplier</span><span class="rf">(Fulfillment)</span></span>`;
    head.classList.add('has-race');
    lab.insertAdjacentHTML('afterend', `<span class="vb n" tabindex="0" role="img" aria-label="${job} race bonuses" data-tip="${tip.replace(/"/g,'&quot;')}">i</span>`);
  }
}

showTab(ACTIVE);
