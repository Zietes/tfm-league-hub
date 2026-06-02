
let D=window.LEAGUE_DATA||{leagues:[],competitions:[],teams:[],athletes:[],matches:[],champions:[],items:[]};
// Indices are rebuilt by buildIndex() so the hosted site can swap in fresh data
// (applyData) without a full-page reload. ATTR_MAX is derived from the data too.
let teamById={},athById={},leagueById={},champByName={},compsByLeague={},ATTR_MAX=1,teamByName={},athByName={},champStatById={},squadByTeam={},poolKnown=false;
function buildIndex(){
  D.items=D.items||[];
  teamById={};athById={};leagueById={};champByName={};compsByLeague={};teamByName={};athByName={};champStatById={};squadByTeam={};
  (D.champ_stats||[]).forEach(c=>champStatById[c.id]=c); // live (post-patch) base stats from the running game
  poolKnown=(D.champ_stats||[]).length>0; // do we know this season's active champion pool? (champ_stats keys = available_champions)
  D.teams.forEach(t=>{teamById[t.id]=t;teamByName[String(t.name).toLowerCase()]=t;});
  D.athletes.forEach(a=>{athById[a.id]=a;athByName[String(a.name).toLowerCase()]=a;
    if(a.team_id!=null)(squadByTeam[a.team_id]=squadByTeam[a.team_id]||[]).push(a.id);}); // full squad incl. subs (accurate team_id)
  D.leagues.forEach(l=>leagueById[l.id]=l);D.champions.forEach(c=>champByName[c.name]=c);
  D.competitions.forEach(c=>{(compsByLeague[c.league_id]=compsByLeague[c.league_id]||[]).push(c);});
  ATTR_MAX=Math.max(1,...D.athletes.flatMap(a=>a.attr?ATTR_DEFS.map(d=>a.attr[d[1]]||0):[0]));
}
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const cap=w=>w?w[0].toUpperCase()+w.slice(1):'';
const champName=id=>String(id).split('_').map(cap).join(' ');
// region_id -> name (from the bundle's text/ui `region.N`; there is no regions table at runtime).
const REGION_NAMES=['Korea','China','Europe','North America','South America','Japan'];
const regionName=id=>REGION_NAMES[id]||('Region '+id);
// Enum to_index() -> label (from text/ui, declaration order = worst→best for satisfaction,
// low→high tier for expectation; matches a top team sitting "Dissatisfied" on an 0–2 start).
const FAN_SAT=['Very Dissatisfied','Dissatisfied','Normal','Satisfied','Very Satisfied'];
const FAN_EXP=['Bottom Tier','Lower Tier','Mid Tier','Upper Tier','Top Tier'];
const fanSat=i=>FAN_SAT[i]||('Lv '+i);
const fanExp=i=>FAN_EXP[i]||('Lv '+i);
// League.name is a short CODE ("TACK"); the in-game display name is region + division. The 12
// base leagues are fixed (6 regions × 2 divisions) — map the code → full name (text/ui league.tack
// resolves to the short "KR Div 1"; this is the long form the game shows). Custom leagues fall back.
const LEAGUE_NAMES={tack:'Korea Division 1',tacc:'China Division 1',tace:'Europe Division 1',taca:'North America Division 1',tacs:'South America Division 1',tacj:'Japan Division 1',tack2:'Korea Division 2',tacc2:'China Division 2',tace2:'Europe Division 2',taca2:'North America Division 2',tacs2:'South America Division 2',tacj2:'Japan Division 2'};
const lgLabel=s=>LEAGUE_NAMES[String(s||'').toLowerCase()]||s; // a league CODE string -> full name (passes non-leagues through)
function lgName(l){if(l==null)return '';if(typeof l!=='object')l=leagueById[l];return l?lgLabel(l.name):'';}
// --- generated iconography (deterministic, offline; also the real-art fallback) ---
function hue(s){let h=0;s=String(s);for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h%360;}
function initials(s){s=String(s||'').trim();const w=s.split(/[\s_]+/).filter(Boolean);
  return (w.length>=2?(w[0][0]+w[1][0]):s.slice(0,2)).toUpperCase();}
function badge(txt,h,cls,size){const st='background:linear-gradient(135deg,hsl('+h+' 52% 46%),hsl('+((h+24)%360)+' 50% 33%))'
  +(size?';width:'+size+'px;height:'+size+'px;line-height:'+size+'px;font-size:'+Math.round(size*0.42)+'px':'');
  return '<span class="'+cls+'" style="'+st+'">'+esc(txt)+'</span>';}
function teamCrest(id,size){const t=teamById[id],nm=t?t.name:'T'+id;return badge(initials(nm),hue(nm),'crest',size);}
// Real team logo cropped from the team_logo atlas via window.TEAM_LOGOS (key->{x,y,w,h} px)
// + TL_SW/TL_SH; falls back to the generated crest when art/data is absent.
function teamLogo(id,size){size=size||20;const t=teamById[id],L=window.TEAM_LOGOS,r=t&&L&&L[t.logo];
  if(!r||!r.h)return teamCrest(id,size);
  // Contain-fit the cell into the square box: the inner <i> is the frame's exact
  // display rectangle (its background clips to that box), centered with letterbox —
  // so adjacent atlas cells never bleed in, regardless of the cell's aspect ratio.
  const s=size/Math.max(r.w,r.h),dw=r.w*s,dh=r.h*s,ox=(size-dw)/2,oy=(size-dh)/2;
  return '<span class="tlogo" style="width:'+size+'px;height:'+size+'px"><i style="width:'+dw.toFixed(1)+'px;height:'+dh.toFixed(1)+'px;left:'+ox.toFixed(1)+'px;top:'+oy.toFixed(1)+'px;background-image:url(\''+(window.ICON_BASE||'')+'icons/team_logo.png\');background-size:'+((window.TL_SW||0)*s).toFixed(1)+'px '+((window.TL_SH||0)*s).toFixed(1)+'px;background-position:'+(-r.x*s).toFixed(1)+'px '+(-r.y*s).toFixed(1)+'px"></i></span>';}
// --- real player sprites: composite the players atlas + recolor via the FaceData recipe ---
// window.PLAYER_CELLS {base,hairN,glassesN,necklaceN,tattooN:[x,y,w,h]} + window.PLAYER_SHEET_URL
// are provided by build_site (hosted site only). Absent (local/broadcast page) → initials avatar.
const SP_HAIR=[[[40,40,46],[20,20,24],[70,70,78]],[[60,42,30],[38,26,18],[88,64,46]],[[92,62,38],[60,40,24],[124,88,58]],[[120,72,42],[84,48,28],[156,104,66]],[[150,112,62],[112,82,44],[190,150,92]],[[222,182,108],[180,142,78],[245,214,150]],[[228,224,214],[188,184,176],[252,250,244]],[[196,96,44],[150,66,28],[230,134,74]],[[128,52,40],[92,34,26],[168,80,60]],[[70,104,176],[44,72,132],[110,148,212]],[[56,150,150],[34,112,112],[96,190,188]],[[84,150,72],[56,112,48],[124,190,108]],[[120,84,168],[86,56,128],[158,120,206]],[[224,128,176],[184,90,138],[245,166,206]],[[128,130,138],[94,96,104],[170,172,180]]];
const SP_CLOTH=[[[196,58,58],[150,38,38],[226,96,96]],[[228,132,52],[186,98,32],[245,168,96]],[[232,196,72],[192,158,46],[248,224,124]],[[150,196,72],[112,156,46],[186,224,116]],[[78,170,86],[50,130,60],[120,206,128]],[[56,170,160],[34,130,122],[100,206,196]],[[80,180,210],[50,140,172],[128,212,236]],[[74,118,200],[48,84,156],[116,158,230]],[[56,72,128],[36,48,94],[92,112,170]],[[128,86,180],[92,58,138],[166,124,212]],[[196,76,160],[152,50,124],[226,116,192]],[[232,140,168],[192,102,130],[248,176,200]],[[140,96,62],[102,68,42],[176,128,90]],[[200,176,140],[162,140,108],[228,208,176]],[[232,234,238],[196,198,204],[252,252,254]],[[120,124,132],[88,92,100],[158,162,170]]];
const spCl=(v,n)=>Math.max(0,Math.min(v|0,n-1));
// remap key-color pixels: (2,0,b)=hair,(1,0,b)=shirt,(0,1,b)=pants,(0,2,b)=boots; b=shade. skin/outline kept.
function spRecolor(d,f){for(let i=0;i<d.length;i+=4){if(d[i+3]<10)continue;const r=d[i],g=d[i+1],b=d[i+2];let p=null;
  if(r===2&&g===0)p=SP_HAIR[spCl(f[1],15)];else if(r===1&&g===0)p=SP_CLOTH[spCl(f[5],16)];
  else if(r===0&&g===1)p=SP_CLOTH[spCl(f[6],16)];else if(r===0&&g===2)p=SP_CLOTH[spCl(f[7],16)];
  if(p){const c=p[Math.min(b,2)]||p[0];d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];}}}
let SP_IMG=null,SP_READY=false;const SP_CACHE={};
function spInit(){if(SP_IMG||!window.PLAYER_SHEET_URL||!window.PLAYER_CELLS)return;SP_IMG=new Image();SP_IMG.onload=function(){SP_READY=true;router();renderRail();};SP_IMG.src=window.PLAYER_SHEET_URL;}
// composite one player's sprite (layers in z-order), recolor, crop to bbox → cache {u,bw,bh}.
function spSprite(f){const sig=f.join(',');if(SP_CACHE[sig])return SP_CACHE[sig];const C=window.PLAYER_CELLS;
  const cv=document.createElement('canvas');cv.width=64;cv.height=64;const x=cv.getContext('2d');x.imageSmoothingEnabled=false;
  const dr=function(k){const r=C[k];if(r)x.drawImage(SP_IMG,r[0],r[1],r[2],r[3],0,0,64,64);};
  dr('base');if(f[2]>0)dr('tattoo'+f[2]);if(f[4]>0)dr('necklace'+f[4]);dr('hair'+f[0]);if(f[3]>0)dr('glasses'+f[3]);
  const id=x.getImageData(0,0,64,64);spRecolor(id.data,f);x.putImageData(id,0,0);
  let mnx=64,mny=64,mxx=-1,mxy=-1;const d=id.data;
  for(let yy=0;yy<64;yy++)for(let xx=0;xx<64;xx++){if(d[(yy*64+xx)*4+3]>10){if(xx<mnx)mnx=xx;if(xx>mxx)mxx=xx;if(yy<mny)mny=yy;if(yy>mxy)mxy=yy;}}
  let r;if(mxx<mnx){r={u:cv.toDataURL(),bw:64,bh:64};}else{const bw=mxx-mnx+1,bh=mxy-mny+1;const c2=document.createElement('canvas');c2.width=bw;c2.height=bh;const x2=c2.getContext('2d');x2.imageSmoothingEnabled=false;x2.drawImage(cv,mnx,mny,bw,bh,0,0,bw,bh);r={u:c2.toDataURL(),bw:bw,bh:bh};}
  SP_CACHE[sig]=r;return r;}
function avatar(id,size){size=size||20;const a=athById[id],nm=a?a.name:'?';
  if(SP_READY&&a&&a.face&&window.PLAYER_CELLS){const s=spSprite(a.face);const sc=size/Math.max(s.bw,s.bh),dw=s.bw*sc,dh=s.bh*sc;
    return '<span class="spr" style="width:'+size+'px;height:'+size+'px"><img src="'+s.u+'" style="width:'+dw.toFixed(1)+'px;height:'+dh.toFixed(1)+'px;left:'+((size-dw)/2).toFixed(1)+'px;top:'+(size-dh).toFixed(1)+'px"></span>';}
  return badge(initials(nm),hue(nm),'av',size);}
function champToken(n,size){return badge(initials(champName(n)),hue(n),'ctok',size);}
// 5 role glyphs (Top/Jungle/Mid/Bot/Sup) as tiny inline SVG paths.
const ROLE_PATH=['M8 3L14 13H2Z','M8 2L12 9H4Z M7 9h2v4H7z','M8 2L14 8 8 14 2 8Z','M2 3h12L8 13Z','M6 2h4v4h4v4h-4v4H6v-4H2V6h4z'];
function roleIcon(p){return(p>=0&&p<5)?'<svg class="rico" viewBox="0 0 16 16"><path d="'+ROLE_PATH[p]+'"/></svg>':'';}
function roleTag(p){return roleIcon(p)+(POS[p]||p);}
const pct=(n,d)=>d?(100*n/d).toFixed(1)+'%':'—';
// AthleteStatistics.rating is a cumulative sum of per-game rating×10 (in-game shows
// the per-game average) — confirmed: Helper rating 227 / (3 games × 10) = 7.57.
const avgRating=(r,m)=>m?(r/(m*10)).toFixed(2):'—';
const tName=id=>teamById[id]?teamById[id].name:'Team '+id;
const tLink=(id,sz)=>'<a href="#/team/'+id+'">'+teamLogo(id,sz)+esc(tName(id))+'</a>';
const aLink=(id,sz)=>athById[id]?'<a href="#/player/'+id+'" data-player="'+id+'">'+avatar(id,sz)+esc(athById[id].name)+'</a>':'#'+id;
// Real champion icon via CSS sprite-crop of the game sheet, using window.CHAMP_FRAMES
// (id -> {x,y,w,h,sw,sh}) + window.ICON_BASE. Absent (e.g. local broadcast page) -> ''.
function champIcon(n,size,ground,extra){size=size||20;const F=window.CHAMP_FRAMES,f=F&&F[n];if(!f||!f.h)return champToken(n,size);
  // Contain-fit a single idle frame into the square box. Most champion frames are
  // taller than wide, so scaling to the box height (the old approach) left the box
  // wider than the frame and the horizontally-packed neighbor frames bled in on the
  // sides. Sizing the inner <i> to the frame's exact display rect (its background
  // clips to that box) and centering it shows ONE frame, letterboxed. ground=true
  // bottom-aligns (standing characters sit on the floor of the box, not floating).
  const s=size/Math.max(f.w,f.h),dw=f.w*s,dh=f.h*s,ox=(size-dw)/2,oy=ground?(size-dh):(size-dh)/2;
  return '<span class="cico'+(extra?' '+extra:'')+'" style="width:'+size+'px;height:'+size+'px"><i style="width:'+dw.toFixed(1)+'px;height:'+dh.toFixed(1)+'px;left:'+ox.toFixed(1)+'px;top:'+oy.toFixed(1)+'px;background-image:url(\''+(window.ICON_BASE||'')+'icons/champion/'+encodeURIComponent(n)+'.png\');background-size:'+(f.sw*s).toFixed(1)+'px '+(f.sh*s).toFixed(1)+'px;background-position:'+(-f.x*s).toFixed(1)+'px '+(-f.y*s).toFixed(1)+'px"></i></span>';}
const cLink=(n,sz)=>'<a href="#/champion/'+encodeURIComponent(n)+'">'+champIcon(n,sz)+esc(champName(n))+'</a>';
const lLink=id=>leagueById[id]?'<a href="#/league/'+id+'">'+esc(lgName(leagueById[id]))+'</a>':('League '+id);
// Inline-SVG sparkline. invert=true puts smaller values up top (for rank, where #1 is best).
function spark(vals,invert,W,H){W=W||150;H=H||32;const P=4,n=vals?vals.length:0;if(n<2)return '<span class="sub">—</span>';
  const min=Math.min(...vals),max=Math.max(...vals),rng=(max-min)||1;
  const X=i=>P+i/(n-1)*(W-2*P),Y=v=>{let t=(v-min)/rng;if(invert)t=1-t;return P+(1-t)*(H-2*P);};
  const pts=vals.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
  return '<svg class="spark" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" preserveAspectRatio="none"><polyline points="'+pts+'"/><circle cx="'+X(n-1).toFixed(1)+'" cy="'+Y(vals[n-1]).toFixed(1)+'" r="2.2"/></svg>';}
const itemName=i=>{const k=D.items[i];return k?champName(k):'#'+i;};
// Item chip: a real icon (hosted) or text-name fallback (in-game). When the item id is known it's a LINK to
// the item page (#/item/:id); data-item drives the hover tooltip (setupTips). title= kept only as the
// name-only fallback when ITEM_DATA is absent (in-game) so hovering still shows the name natively.
function itemChip(i,size){const id=D.items[i]||'',ic=itemIcon(i,size||26),hd=!!(id&&window.ITEM_DATA&&window.ITEM_DATA[id]);
  const inner=ic||esc(itemName(i)),cls=ic?'ichip':'itxt';
  const attr=(id?' data-item="'+esc(id)+'"':'')+(hd?'':' title="'+esc(itemName(i))+'"');
  return id?'<a class="'+cls+'" href="#/item/'+encodeURIComponent(id)+'"'+attr+'>'+inner+'</a>':'<span class="'+cls+'"'+attr+'>'+inner+'</span>';}
// Rich item tooltip body from window.ITEM_DATA (hosted site only). Empty when absent → no tooltip shown.
function itemTip(id){const d=window.ITEM_DATA&&window.ITEM_DATA[id];if(!d)return '';
  let h='<div class="itip-h"><span class="itip-n">'+esc(d.name)+'</span><span class="itip-t">Tier '+d.tier+'</span></div>'
    +'<div class="itip-sub">'+esc(d.cat||'')+(d.price?' · $'+d.price.toLocaleString():'')+'</div>';
  if(d.stats&&d.stats.length)h+='<ul class="itip-st">'+d.stats.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>';
  if(d.option)h+='<div class="itip-o">'+esc(d.option)+'</div>';
  if(d.into&&d.into.length)h+='<div class="itip-into">Builds into '+d.into.map(x=>esc((window.ITEM_DATA[x]&&window.ITEM_DATA[x].name)||champName(x))).join(', ')+'</div>';
  return h;}
// Player tooltip — team + key stats (works in-game too: only needs D.athletes/D.teams, no external data).
function playerTip(id){const a=athById[id];if(!a)return '';const t=a.team_id!=null?teamById[a.team_id]:null,bp=bestPos(a);
  let h='<div class="itip-h"><span class="itip-n">'+esc(a.name)+'</span>'+(bp?'<span class="itip-t">'+POS[bp.idx]+'</span>':'')+'</div>'
    +'<div class="ptip-team">'+(t?teamLogo(t.id,18)+esc(t.name):'<span class="sub">Free agent</span>')+'</div>';
  const bits=[];if(a.matches){bits.push('Rating '+avgRating(a.rating,a.matches));bits.push(a.wins+'–'+(a.matches-a.wins)+' · '+pct(a.wins,a.matches));}
  bits.push('Age '+a.age);
  return h+'<div class="ptip-stats">'+bits.join(' <span class="dot">·</span> ')+'</div>';}
// Team tooltip — league, league position/record, fans, balance (works in-game; only needs D data).
function teamTip(id){const t=teamById[id];if(!t)return '';let rk=null,st=null;
  for(const c of (compsByLeague[t.league_id]||[])){const idx=c.standings.findIndex(s=>s.team_id==id);if(idx>=0){rk=idx+1;st=c.standings[idx];break;}}
  let h='<div class="itip-h"><span class="itip-n">'+esc(t.name)+'</span>'+(rk?'<span class="itip-t">#'+rk+'</span>':'')+'</div>'
    +'<div class="ptip-team">'+teamLogo(t.id,18)+esc(lgName(t.league_id))+'</div>';
  const bits=[];if(st)bits.push(st.win+'–'+st.lose+' · '+st.points+' pts');bits.push((t.fan_count||0).toLocaleString()+' fans');bits.push(money(t.balance));
  return h+'<div class="ptip-stats">'+bits.join(' <span class="dot">·</span> ')+'</div>';}
// One delegated hover tooltip; detection is HREF-based so EVERY player/item/team link gets a card —
// including hand-built links (e.g. Role specialists) that don't carry a data-* attribute. Set up once.
function tipHTML(el){const href=(el.getAttribute&&el.getAttribute('href'))||'';let m;
  if(m=href.match(/^#\/player\/(\d+)/))return playerTip(+m[1]);
  if(m=href.match(/^#\/team\/(\d+)/))return teamTip(+m[1]);
  if(m=href.match(/^#\/item\/(.+)$/))return itemTip(decodeURIComponent(m[1]));
  return '';}
function setupTips(){if(window.__tips||typeof document==='undefined')return;window.__tips=1;
  const tip=document.createElement('div');tip.id='itip';tip.style.display='none';document.body.appendChild(tip);let cur=null;const SEL='a[href]';
  const pos=e=>{const pad=14,w=tip.offsetWidth,h=tip.offsetHeight;let x=e.clientX+pad,y=e.clientY+pad;
    if(x+w>innerWidth-8)x=e.clientX-pad-w;if(y+h>innerHeight-8)y=e.clientY-pad-h;tip.style.left=Math.max(8,x)+'px';tip.style.top=Math.max(8,y)+'px';};
  const hide=()=>{if(cur){cur=null;tip.style.display='none';}};
  document.addEventListener('mouseover',e=>{const el=e.target.closest&&e.target.closest(SEL);if(!el){hide();return;}const html=tipHTML(el);if(!html){hide();return;}cur=el;tip.innerHTML=html;tip.style.display='block';pos(e);});
  document.addEventListener('mousemove',e=>{if(cur)pos(e);});
  document.addEventListener('mouseout',e=>{const el=e.target.closest&&e.target.closest(SEL);if(el&&el===cur)hide();});
}
// item icon: CSS-crop the 18×18 atlas via window.ITEM_ICONS[i]=[x,y,w,h] px. Absent → ''.
// ability icon: CSS-crop the skill_icon atlas via window.SKILL_ICONS["<champ>_<idx>"]. Absent → ''.
function skillIcon(name,idx,size){size=size||28;const r=window.SKILL_ICONS&&window.SKILL_ICONS[name+'_'+idx];if(!r||!r[3])return '';
  const s=size/r[3];
  return '<span class="sico" style="width:'+(r[2]*s).toFixed(1)+'px;height:'+size+'px;background-image:url(\''+(window.ICON_BASE||'')+window.SKILL_SHEET_URL+'\');background-size:'+(window.SKILL_SW*s).toFixed(1)+'px '+(window.SKILL_SH*s).toFixed(1)+'px;background-position:'+(-r[0]*s).toFixed(1)+'px '+(-r[1]*s).toFixed(1)+'px"></span>';}
function itemIcon(i,size){size=size||24;const r=window.ITEM_ICONS&&window.ITEM_ICONS[i];if(!r||!r[3])return '';
  const s=size/r[3];
  return '<span class="iico" style="width:'+(r[2]*s).toFixed(1)+'px;height:'+size+'px;background-image:url(\''+(window.ICON_BASE||'')+window.ITEM_SHEET_URL+'\');background-size:'+(window.ITEM_SW*s).toFixed(1)+'px '+(window.ITEM_SH*s).toFixed(1)+'px;background-position:'+(-r[0]*s).toFixed(1)+'px '+(-r[1]*s).toFixed(1)+'px"></span>';}
// Facility/stadium grade enum index -> letter (confirmed in-game: A=3, S=4).
const grade=i=>['D','C','B','A','S'][i]||('Lv '+i);
// The game stores all currency at 1000x the displayed amount (verified in-game: a raw
// balance of 24,997,124,341 shows as ~$25M), so scale down before formatting. EVERY money
// value (balances, budgets, prize pools, transfer fees, salaries) goes through here.
const money=v=>{v=(+v||0)/1000;const s=v<0?'-':'';v=Math.abs(v);if(v>=1e9)return s+'$'+(v/1e9).toFixed(2)+'B';if(v>=1e6)return s+'$'+(v/1e6).toFixed(1)+'M';if(v>=1e3)return s+'$'+(v/1e3).toFixed(1)+'K';return s+'$'+v.toFixed(0);};
const POS=['Top','Jungle','Mid','Bot','Sup'];
const ATTR_DEFS=[['Monster Kills','last_hit'],['Skill Dodge','skill_avoid'],['Skill Hit','skill_hit'],['Control Speed','control_speed'],['Positioning','positioning'],['Judgment','judgement'],['Mental','mental'],['Focus','concentration'],['Calls','order'],['Roaming','roaming'],['Aggression','aggressive'],['Ego','ego']];
// best-played role from the role-proficiency block (a.pos), with its prof value.
const POS_KEYS=['top','jungle','mid','bottom','support'];
function bestPos(a){if(!a||!a.pos)return null;let bi=-1,bv=-1;POS_KEYS.forEach((k,i)=>{const v=a.pos[k]||0;if(v>bv){bv=v;bi=i;}});return bv>0?{idx:bi,val:bv}:null;}
// Overall = mean of the 12 attributes — a sortable talent proxy for players with no match history (e.g. free agents).
function ovr(a){if(!a||!a.attr)return 0;let s=0;for(const d of ATTR_DEFS)s+=a.attr[d[1]]||0;return Math.round(s/ATTR_DEFS.length);}
// Is this champion in THIS season's active pool? champ_stats is built from available_champions, so its keys ARE
// the pool. When champ_stats is absent (in-game broadcast page / pre-load) the pool is unknown → treat all as
// available (no filtering, no regression).
const inPool=n=>!poolKnown||!!champStatById[n];
function makeSortable(t){if(!t.tHead||!t.tHead.rows[0]||!t.tBodies[0])return; // headerless tables (e.g. the H2H comparison grid) aren't sortable
  [...t.tHead.rows[0].cells].forEach((th,i)=>{if('nosort' in th.dataset)return;th.style.cursor='pointer';
  th.onclick=()=>{const tb=t.tBodies[0];const rows=[...tb.rows];const dir=th._d=-(th._d||1);const num='num' in th.dataset;
    rows.sort((a,b)=>{let x=a.cells[i].dataset.s??a.cells[i].textContent,y=b.cells[i].dataset.s??b.cells[i].textContent;if(num){x=parseFloat(x)||0;y=parseFloat(y)||0;}else{x=(''+x).toLowerCase();y=(''+y).toLowerCase();}return x<y?dir:x>y?-dir:0;});
    rows.forEach(r=>tb.appendChild(r));};});}
let _reveal=false;
function mount(html){const app=document.getElementById('app');app.innerHTML=html;app.querySelectorAll('table.s').forEach(makeSortable);setupTips();
  // Replay the staggered entrance only on real navigation (go()), never on the 20s data-refresh
  // re-render (would be a jarring fade every tick) — so clear the class when not revealing.
  if(_reveal){app.classList.remove('reveal');void app.offsetWidth;app.classList.add('reveal');}else app.classList.remove('reveal');}
function nav(){document.getElementById('nav').innerHTML='<span class="brand">🏆 League Hub</span>'+
  '<a href="#/">Home</a><a href="#/standings">Standings</a><a href="#/news">News</a><a href="#/leagues">Leagues</a><a href="#/teams">Teams</a><a href="#/players">Players</a><a href="#/champions">Champions</a><a href="#/items">Items</a><a href="#/matches">Matches</a>'+
  '<input id="q" placeholder="Search teams, players, champions…"><span class="upd">#'+(D.updated||0)+'</span>';
  const q=document.getElementById('q');q.oninput=()=>{const v=q.value.trim();location.hash=v?('#/search/'+encodeURIComponent(v)):'#/';};}
function statCell(l,v,cls){return '<div><span class="l">'+esc(l)+'</span><span class="v'+(cls?' '+cls:'')+'">'+v+'</span></div>';}
function heroHeader(art,kick,title,sub,stats){return '<div class="hero">'+(art?'<div class="art">'+art+'</div>':'')+
  '<div class="ht"><div class="kick">'+esc(kick)+'</div><h1>'+title+'</h1>'+(sub?'<p class="sub">'+sub+'</p>':'')+
  (stats&&stats.length?'<div class="statline">'+stats.join('')+'</div>':'')+'</div></div>';}
function scrollToEl(id){const e=document.getElementById(id);if(e)e.scrollIntoView({behavior:'smooth',block:'start'});}
// ===== Home / landing: a "portal front door" — bold hero, the featured storyline,
// a meta snapshot, and section tiles that route into the hub (each with a live highlight). =====
function vHome(){
  const leaders=[];D.competitions.forEach(c=>{if(c.standings&&c.standings[0])leaders.push(c.standings[0]);});leaders.sort((a,b)=>b.points-a.points);
  const lead0=leaders[0];
  // Featured story = top synthesized story (exclude transfers — their fee-based score skews the pool).
  const feat=[].concat(deskResults(2),deskStandings(1),deskMeta(1),deskPlayers(1)).filter(Boolean).sort((a,b)=>b.score-a.score)[0];
  const topP=D.athletes.filter(a=>a.matches>=3).sort((a,b)=>(b.rating/(b.matches*10))-(a.rating/(a.matches*10)))[0];
  const ranked=D.champions.map(c=>({c,m:champMeta(c)})).filter(x=>x.m).sort((a,b)=>b.m.score-a.m.score);
  const topC=ranked[0]&&ranked[0].c;const lastM=D.matches&&D.matches[0];
  // hero
  let h='<section class="home-hero"><div class="hh-badge"><span class="livedot"></span>LIVE'+(D.today?' · '+esc(D.today):'')+'</div>'
    +'<h1 class="hh-title">League <span>Hub</span></h1>'
    +'<p class="hh-tag">'+D.leagues.length+' divisions, '+D.teams.length+' clubs, one table that never stops moving.</p>'
    +'<div class="hh-stats">'+[['Divisions',D.leagues.length],['Clubs',D.teams.length],['Champions',D.champions.length],['Leader',lead0?esc(tName(lead0.team_id)):'—']]
      .map(s=>'<div class="hh-stat"><span class="l">'+s[0]+'</span><span class="v">'+s[1]+'</span></div>').join('')+'</div></section>';
  // featured storyline
  if(feat)h+='<a class="home-lead" href="'+feat.link+'"><span class="ntag '+(feat.cls||'')+'">'+esc(feat.tag)+'</span><div class="hl-h">'+esc(feat.head)+'</div><p class="hl-b">'+esc(feat.blurb)+'</p><span class="byline">The '+esc(feat.desk||'News')+' Desk →</span></a>';
  // meta snapshot — top champions as grounded icon chips
  if(ranked.length)h+='<section class="home-sec"><div class="sec-h"><h3>Meta Snapshot</h3><a class="rc-more" href="#/champions">full tier list →</a></div><div class="tier-band">'
    +ranked.slice(0,10).map(x=>'<a class="tband-chip" href="#/champion/'+encodeURIComponent(x.c.name)+'">'+champIcon(x.c.name,32,true,'show')+'<span>'+esc(champName(x.c.name))+'</span></a>').join('')+'</div></section>';
  // explore tiles (each a live highlight + a route in)
  const tile=(href,kick,big,sub,art,emoji)=>'<a class="tile" href="'+href+'"><div class="tile-art'+(emoji?' emoji':'')+'">'+(art||emoji||'')+'</div><div class="tile-b"><span class="tile-k">'+kick+'</span><div class="tile-big">'+big+'</div>'+(sub?'<span class="tile-s">'+sub+'</span>':'')+'</div><span class="tile-arrow">→</span></a>';
  let tiles='';
  tiles+=tile('#/standings','Standings',lead0?esc(tName(lead0.team_id)):'View table',lead0?'leads on '+lead0.points+' pts':'custom-points standings',lead0?teamLogo(lead0.team_id,40):'');
  tiles+=tile('#/leagues','Leagues',D.leagues.length+' divisions','across six regions','','🏆');
  tiles+=tile('#/players','Players',topP?esc(topP.name):'Browse',topP?'top rating '+avgRating(topP.rating,topP.matches):D.athletes.length+' athletes',topP?avatar(topP.id,40):'');
  tiles+=tile('#/champions','Champions',topC?esc(champName(topC.name)):'Tier list',topC?'tops the meta':D.champions.length+' champions',topC?champIcon(topC.name,40,true,'bare'):'');
  tiles+=tile('#/matches','Matches',lastM?esc(tName(lastM.blue_win?lastM.blue_team_id:lastM.red_team_id))+' won':'Results',lastM?'latest result':'recent games',lastM?teamLogo(lastM.blue_win?lastM.blue_team_id:lastM.red_team_id,40):'');
  tiles+=tile('#/news','Newsroom',feat?esc(clip(feat.head,34)):'The Wire','synthesized desks & wire','','📰');
  tiles+=tile('#/teams','Teams',D.teams.length+' clubs','rosters, finances & form','','🛡️');
  h+='<section class="home-sec explore"><div class="sec-h"><h3>Explore the Hub</h3></div><div class="tiles">'+tiles+'</div></section>';
  mount(h);
}
function vStandings(){
  let h=heroHeader('','League Hub','Standings','Custom-points standings · auto-updating live',
    [statCell('Leagues',D.leagues.length),statCell('Teams',D.teams.length),statCell('Update','#'+(D.updated||0))]);
  const pills=[];D.leagues.forEach(l=>{if((compsByLeague[l.id]||[]).length)pills.push('<a onclick="scrollToEl(\'lg-'+l.id+'\')">'+esc(lgName(l))+'</a>');});
  if(pills.length>1)h+='<div class="switch">'+pills.join('')+'</div>';
  D.leagues.forEach(l=>{(compsByLeague[l.id]||[]).forEach(c=>{
  h+='<h2 id="lg-'+l.id+'">'+lLink(l.id)+'</h2><table class="s"><thead><tr><th data-nosort>#</th><th>Team</th><th data-num>Pts</th><th data-num>W</th><th data-num>L</th><th data-num>Win%</th><th data-num>SW</th><th data-num>SL</th><th data-num>K</th><th data-num>Adj</th></tr></thead><tbody>';
  c.standings.forEach((s,i)=>{const adj=s.adj?('<span class="'+(s.adj>0?'pos">+':'neg">')+s.adj+'</span>'):'';
    h+='<tr'+(i===0?' class="lead"':'')+'><td class="'+(i<3?'r'+(i+1):'')+'">'+(i+1)+'</td><td>'+tLink(s.team_id)+'</td><td class="num"><b>'+s.points+'</b></td><td class="num">'+s.win+'</td><td class="num">'+s.lose+'</td><td class="num">'+pct(s.win,s.win+s.lose)+'</td><td class="num">'+s.set_win+'</td><td class="num">'+s.set_lose+'</td><td class="num">'+s.kill+'</td><td class="num">'+adj+'</td></tr>';});
  h+='</tbody></table>';});});mount(h);}
function vTeams(){let h='<h1>Teams</h1><p class="sub">click a column to sort · '+D.teams.length+' clubs · Squad = full roster incl. subs, Bench = non-starters</p><table class="s"><thead><tr><th>Team</th><th>Manager</th><th>League</th><th data-num>Squad</th><th data-num>Bench</th><th data-num>Fans</th><th data-num>Balance</th></tr></thead><tbody>';
  D.teams.forEach(t=>{const sq=(squadByTeam[t.id]||[]).length,starters=(t.roster||[]).filter(x=>x!=null).length,bench=Math.max(0,sq-starters);
    h+='<tr><td>'+tLink(t.id,40)+'</td><td>'+esc(t.manager)+'</td><td>'+lLink(t.league_id)+'</td><td class="num" data-s="'+sq+'">'+sq+'</td><td class="num" data-s="'+bench+'">'+(bench||'<span class="sub">0</span>')+'</td><td class="num" data-s="'+t.fan_count+'">'+t.fan_count.toLocaleString()+'</td><td class="num" data-s="'+t.balance+'">'+money(t.balance)+'</td></tr>';});
  mount(h+'</tbody></table>');}
function vTeam(id){const t=teamById[id];if(!t)return mount('<h1>Team not found</h1>');
  let rk=null,st=null;for(const c of (compsByLeague[t.league_id]||[])){const i=c.standings.findIndex(s=>s.team_id==id);if(i>=0){rk=i+1;st=c.standings[i];break;}}
  const stats=[];if(rk)stats.push(statCell('Rank','#'+rk,rk===1?'gold':''));
  if(st){stats.push(statCell('Record',st.win+'–'+st.lose));stats.push(statCell('Win%',pct(st.win,st.win+st.lose)));}
  stats.push(statCell('Fans',t.fan_count.toLocaleString()));stats.push(statCell('Balance',money(t.balance),t.balance<0?'neg':''));
  const sqN=(squadByTeam[id]||[]).length;if(sqN)stats.push(statCell('Squad',sqN));
  let h=heroHeader(teamLogo(id,74),'Team',esc(t.name),lLink(t.league_id)+' · manager '+esc(t.manager),stats);
  if(t.rank_hist&&t.rank_hist.length>1){
    h+='<h2>Standings trend <small>last '+t.rank_hist.length+' days'+(rk?' · now #'+rk:'')+'</small></h2>'+spark(t.rank_hist,true,220,40);}
  const f=t.finance;
  if(f){const fc=(l,v,cls,sub)=>'<div class="fcard"><span class="l">'+l+'</span><span class="v'+(cls?' '+cls:'')+'">'+v+'</span>'+(sub?'<span class="s">'+sub+'</span>':'')+'</div>';
    h+='<h2>Business &amp; finances</h2><div class="fin">'
      +fc('Transfer Budget',money(f.transfer_budget))
      +fc('Salary Budget',money(f.salary_budget))
      +fc('Scout Budget',money(f.scout_budget))
      +fc('Popularity',f.popularity||0)
      +fc('Fan Momentum',(f.fan_momentum>0?'+':'')+(f.fan_momentum||0),f.fan_momentum>0?'pos':f.fan_momentum<0?'neg':'')
      +fc('Fan Satisfaction',esc(fanSat(f.fan_satisfaction)),f.fan_satisfaction>=3?'pos':f.fan_satisfaction<=1?'neg':'')
      +fc('Fan Expectation',esc(fanExp(f.fan_expectation)))
      +fc('🏟 '+esc(f.stadium_name||'Stadium'),grade(f.stadium_grade)+' grade','','cap '+(f.stadium_capacity||0).toLocaleString())
      +fc('Home Gate',money(f.entrance_income),'',(f.home_matches||0)+' games · '+(f.home_attendance||0).toLocaleString()+' att.')
      +fc('Training',grade(f.training_grade))
      +fc('Merchandise',grade(f.merch_grade))
      +fc('Gaming House',grade(f.gaming_house))
      +'</div>';}
  h+='<h2>Roster <small>starting lineup</small></h2><div class="roster">';
  t.roster.forEach((aid,i)=>{const a=aid!=null?athById[aid]:null;
    h+='<div class="rcard"><div class="rcard-h"><span class="rcard-pos">'+roleIcon(i)+(POS[i]||('P'+i))+'</span>'+(a&&a.matches?'<span class="rcard-rt">'+avgRating(a.rating,a.matches)+'</span>':'')+'</div>'
      +(a?'<a class="rcard-p" href="#/player/'+aid+'">'+avatar(aid,36)+'<span>'+esc(a.name)+'</span></a>':'<div class="rcard-empty">Vacant</div>')
      +(a&&a.recent_champions&&a.recent_champions.length?'<div class="rcard-champs">'+a.recent_champions.slice(0,5).map(c=>'<a href="#/champion/'+encodeURIComponent(c)+'" title="'+esc(champName(c))+'">'+champIcon(c,26,true,'')+'</a>').join('')+'</div>':'')
      +'</div>';});
  h+='</div>';
  // Subs / squad depth: athletes contracted to this team who aren't in the starting five.
  const starters=new Set(t.roster.filter(x=>x!=null));
  const subs=D.athletes.filter(a=>a.team_id==id&&!starters.has(a.id)).sort((a,b)=>(b.matches-a.matches)||(b.rating/((b.matches||1)*10)-a.rating/((a.matches||1)*10)));
  if(subs.length){h+='<h2>Substitutes <small>'+subs.length+' on the bench</small></h2><div class="roster">';
    subs.forEach(a=>{h+='<div class="rcard"><div class="rcard-h"><span class="rcard-pos">SUB</span>'+(a.matches?'<span class="rcard-rt">'+avgRating(a.rating,a.matches)+'</span>':'')+'</div>'
      +'<a class="rcard-p" href="#/player/'+a.id+'">'+avatar(a.id,36)+'<span>'+esc(a.name)+'</span></a>'
      +(a.recent_champions&&a.recent_champions.length?'<div class="rcard-champs">'+a.recent_champions.slice(0,5).map(c=>'<a href="#/champion/'+encodeURIComponent(c)+'" title="'+esc(champName(c))+'">'+champIcon(c,26,true,'')+'</a>').join('')+'</div>':'')
      +'</div>';});
    h+='</div>';}
  const ms=D.matches.filter(m=>m.blue_team_id==id||m.red_team_id==id);
  if(ms.length){const h2h={};ms.forEach(m=>{const opp=m.blue_team_id==id?m.red_team_id:m.blue_team_id,won=(m.blue_team_id==id)===m.blue_win;const e=(h2h[opp]=h2h[opp]||{g:0,w:0});e.g++;if(won)e.w++;});
    const rows=Object.keys(h2h).map(o=>({o:+o,g:h2h[o].g,w:h2h[o].w})).sort((a,b)=>b.g-a.g||b.w/b.g-a.w/a.g);
    h+='<h2>Head-to-head <small>record vs each opponent · click a record to compare</small></h2><table class="s"><thead><tr><th>Opponent</th><th data-num>Games</th><th data-num>Record</th><th data-num>Win%</th></tr></thead><tbody>'
      +rows.map(x=>'<tr><td>'+tLink(x.o)+'</td><td class="num">'+x.g+'</td><td class="num"><a href="#/h2h/'+id+'/'+x.o+'">'+x.w+'–'+(x.g-x.w)+'</a></td><td class="num '+(x.w/x.g>=0.5?'win':'loss')+'">'+pct(x.w,x.g)+'</td></tr>').join('')+'</tbody></table>';}
  // Per-team champion pick/ban tendencies from this team's recent games.
  const tp={},tb={};let tg=0;
  ms.forEach(m=>{const isB=m.blue_team_id==id;tg++;
    m.picks.forEach(p=>{if(p.blue===isB)tp[p.champion]=(tp[p.champion]||0)+1;});
    ((isB?m.blue_bans:m.red_bans)||[]).forEach(b=>tb[b]=(tb[b]||0)+1);});
  const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
  const pks=top(tp),bns=top(tb);
  if(pks.length||bns.length){h+='<h2>Picks &amp; bans <small>(last '+tg+' games)</small></h2><div style="display:flex;gap:24px;flex-wrap:wrap">';
    const tbl=(title,rows)=>'<div><table class="s"><thead><tr><th>'+title+'</th><th data-num>Games</th></tr></thead><tbody>'+(rows.map(e=>'<tr><td>'+cLink(e[0])+'</td><td class="num">'+e[1]+'</td></tr>').join('')||'<tr><td class="sub">none</td><td></td></tr>')+'</tbody></table></div>';
    h+=tbl('Most picked',pks)+tbl('Most banned',bns)+'</div>';}
  mount(h);}
// ===== Team head-to-head: two teams compared + every meeting between them. =====
function vH2H(a,b){a=+a;b=+b;const ta=teamById[a],tb=teamById[b];if(!ta||!tb)return mount('<h1>Head-to-head</h1><p class="sub">Teams not found. <a href="#/teams">← Teams</a></p>');
  const games=D.matches.filter(m=>(m.blue_team_id==a&&m.red_team_id==b)||(m.blue_team_id==b&&m.red_team_id==a));
  let aw=0,bw=0;games.forEach(m=>{if((m.blue_team_id==a)===m.blue_win)aw++;else bw++;});
  const standOf=tid=>{const t=teamById[tid];for(const c of (compsByLeague[t.league_id]||[])){const i=c.standings.findIndex(s=>s.team_id==tid);if(i>=0)return {rank:i+1,st:c.standings[i]};}return null;};
  const ratingOf=t=>{const r=(t.roster||[]).filter(x=>x!=null).map(x=>athById[x]).filter(p=>p&&p.matches);return r.length?r.reduce((s,p)=>s+p.rating/(p.matches*10),0)/r.length:0;};
  const sa=standOf(a),sb=standOf(b);
  let h='<p class="sub"><a href="#/team/'+a+'">← '+esc(ta.name)+'</a></p>';
  h+='<section class="h2h-hero"><a class="h2h-team" href="#/team/'+a+'">'+teamLogo(a,56)+'<span>'+esc(ta.name)+'</span></a>'
    +'<div class="h2h-score"><span'+(aw>bw?' class="win"':'')+'>'+aw+'</span><span class="h2h-dash">–</span><span'+(bw>aw?' class="win"':'')+'>'+bw+'</span><span class="h2h-sub">'+games.length+' meeting'+(games.length===1?'':'s')+'</span></div>'
    +'<a class="h2h-team" href="#/team/'+b+'">'+teamLogo(b,56)+'<span>'+esc(tb.name)+'</span></a></section>';
  // comparison grid (highlight the better side; cross-league rank shown neutral)
  const cmp=(label,av,bv,da,db,hi)=>{let ca='',cb='';if(hi!=null&&av!==bv){const aB=hi?av>bv:av<bv;ca=aB?'h2h-best':'';cb=aB?'':'h2h-best';}
    return '<tr><td class="num '+ca+'">'+da+'</td><th>'+label+'</th><td class="num '+cb+'">'+db+'</td></tr>';};
  let cr='';
  if(sa&&sb){cr+=cmp('League position',sa.rank,sb.rank,'#'+sa.rank+' <span class="sub">'+esc(lgName(ta.league_id))+'</span>','#'+sb.rank+' <span class="sub">'+esc(lgName(tb.league_id))+'</span>',null);
    cr+=cmp('League record',sa.st.win/((sa.st.win+sa.st.lose)||1),sb.st.win/((sb.st.win+sb.st.lose)||1),sa.st.win+'–'+sa.st.lose,sb.st.win+'–'+sb.st.lose,true);
    cr+=cmp('Points',sa.st.points,sb.st.points,sa.st.points,sb.st.points,true);}
  const ra=ratingOf(ta),rb=ratingOf(tb);
  cr+=cmp('Avg player rating',ra,rb,ra?ra.toFixed(2):'—',rb?rb.toFixed(2):'—',true);
  cr+=cmp('Fans',ta.fan_count||0,tb.fan_count||0,(ta.fan_count||0).toLocaleString(),(tb.fan_count||0).toLocaleString(),true);
  cr+=cmp('Balance',ta.balance||0,tb.balance||0,money(ta.balance),money(tb.balance),true);
  h+='<h2>Comparison</h2><table class="s h2h-cmp"><tbody>'+cr+'</tbody></table>';
  if(games.length){h+='<h2>Meetings <small>team kills shown as the score</small></h2><table class="s"><thead><tr><th style="text-align:right">'+esc(ta.name)+'</th><th data-nosort>Score</th><th>'+esc(tb.name)+'</th><th data-nosort></th></tr></thead><tbody>'
    +games.map(m=>{const aWon=(m.blue_team_id==a)===m.blue_win;const ak=m.blue_team_id==a?m.blue_perf.kills:m.red_perf.kills,bk=m.blue_team_id==a?m.red_perf.kills:m.blue_perf.kills;
      return '<tr><td style="text-align:right" class="'+(aWon?'win':'')+'">'+esc(ta.name)+'</td><td class="num"><b>'+ak+'–'+bk+'</b></td><td class="'+(!aWon?'win':'')+'">'+esc(tb.name)+'</td><td><a href="#/match/'+m.id+'">view</a></td></tr>';}).join('')+'</tbody></table>';}
  else h+='<p class="sub">These teams haven’t met in the recorded games.</p>';
  mount(h);}
function vPlayers(){const fa=D.athletes.filter(a=>a.team_id==null).length;
  let h='<h1>Players</h1><p class="sub">click a column to sort · '+D.athletes.length+' athletes'+(fa?' · <a href="#/free-agents">'+fa+' free agents →</a>':'')+'</p><table class="s"><thead><tr><th>Player</th><th>Team</th><th data-num>Age</th><th data-num>M</th><th data-num>W</th><th data-num>Rating</th><th data-num>K</th><th data-num>D</th><th data-num>A</th><th data-num>MVP</th></tr></thead><tbody>';
  D.athletes.forEach(a=>{h+='<tr><td>'+aLink(a.id,40)+'</td><td>'+(a.team_id!=null?tLink(a.team_id):'<span class="sub">FA</span>')+'</td><td class="num">'+a.age+'</td><td class="num">'+a.matches+'</td><td class="num">'+a.wins+'</td><td class="num">'+avgRating(a.rating,a.matches)+'</td><td class="num">'+a.kills+'</td><td class="num">'+a.deaths+'</td><td class="num">'+a.assists+'</td><td class="num">'+a.mvp+'</td></tr>';});
  mount(h+'</tbody></table>');}
function vPlayer(id){const a=athById[id];if(!a)return mount('<h1>Player not found</h1>');
  const kda=a.deaths?((a.kills+a.assists)/a.deaths).toFixed(2):(a.kills+a.assists?'∞':'—');
  const stats=[statCell('Rating',avgRating(a.rating,a.matches)),statCell('Matches',a.matches),statCell('Win%',pct(a.wins,a.matches)),statCell('KDA',kda),statCell('MVP',a.mvp)];
  let h=heroHeader(avatar(id,74),'Player',esc(a.name),(a.team_id!=null?tLink(a.team_id):'Free agent')+' · age '+a.age,stats);
  h+='<h2>Recent champions</h2><div class="chips">'+(a.recent_champions.map(c=>'<span>'+cLink(c)+'</span>').join('')||'<span class="sub">none</span>')+'</div>';
  if(a.likes&&a.likes.length)h+='<h2>Favored champions <small>👍</small></h2><div class="chips">'+a.likes.map(c=>'<span>'+cLink(c)+'</span>').join('')+'</div>';
  if(a.dislikes&&a.dislikes.length)h+='<h2>Disliked champions <small>👎</small></h2><div class="chips">'+a.dislikes.map(c=>'<span>'+cLink(c)+'</span>').join('')+'</div>';
  if(a.pos){const PD=[['Top','top',0],['Jungle','jungle',1],['Mid','mid',2],['Bot','bottom',3],['Sup','support',4]].filter(d=>(a.pos[d[1]]||0)>0);
    if(PD.length){h+='<h2>Positions</h2><table>'+PD.map(d=>{const v=a.pos[d[1]]||0,st=Math.round(v/20);return '<tr><td>'+roleIcon(d[2])+d[0]+'</td><td class="num">'+v+'</td><td>'+'★'.repeat(st)+'<span class="sub">'+'☆'.repeat(5-st)+'</span></td></tr>';}).join('')+'</table>';}}
  if(a.languages&&a.languages.length)h+='<h2>Communication</h2><div class="chips">'+a.languages.map(l=>{const st=Math.round((l.prof||0)/20);return '<span>'+esc(regionName(l.region))+' '+'★'.repeat(st)+'<span class="sub">'+'☆'.repeat(5-st)+'</span></span>';}).join('')+'</div>';
  if(a.attr){h+='<h2>Attributes</h2><div class="attrs">'+ATTR_DEFS.map(d=>{const v=a.attr[d[1]]||0;return '<div class="attr-row"><span class="attr-l">'+d[0]+'</span><span class="attr-v">'+v+'</span><div class="bar"><i style="width:'+(100*v/ATTR_MAX).toFixed(0)+'%"></i></div></div>';}).join('')+'</div>';}
  if(a.soloranks&&a.soloranks.length){h+='<h2>Solo rank</h2><table class="s"><thead><tr><th>Region</th><th data-num>Rating</th><th data-num>W</th><th data-num>L</th><th data-num>Win%</th></tr></thead><tbody>'+
    a.soloranks.map(s=>'<tr><td>'+esc(regionName(s.region))+'</td><td class="num"><b>'+s.rating+'</b></td><td class="num">'+s.wins+'</td><td class="num">'+s.losses+'</td><td class="num">'+pct(s.wins,s.wins+s.losses)+'</td></tr>').join('')+'</tbody></table>';}
  if(a.seasons&&a.seasons.length){h+='<h2>Season history</h2><table class="s"><thead><tr><th data-num>Year</th><th>Role</th><th data-num>M</th><th data-num>W</th><th data-num>Win%</th><th>KDA</th><th data-num>Rating</th><th data-num>MVP</th></tr></thead><tbody>';
    a.seasons.forEach(se=>se.positions.forEach(p=>{h+='<tr><td class="num">'+se.year+'</td><td>'+roleTag(p.position)+'</td><td class="num">'+p.matches+'</td><td class="num">'+p.wins+'</td><td class="num">'+pct(p.wins,p.matches)+'</td><td class="num">'+p.kills+'/'+p.deaths+'/'+p.assists+'</td><td class="num">'+avgRating(p.rating,p.matches)+'</td><td class="num">'+p.mvp+'</td></tr>';}));
    h+='</tbody></table>';}
  const tr=(D.transfers||[]).filter(t=>t.athlete_id==id);
  if(tr.length){h+='<h2>Career <small>transfer history</small></h2><table class="s"><thead><tr><th>Date</th><th>From</th><th>To</th><th data-num>Fee</th><th data-num>Salary</th></tr></thead><tbody>'+
    tr.map(t=>'<tr><td class="sub">'+esc(t.date||'')+'</td><td>'+(t.from!=null?tLink(t.from):'<span class="sub">debut</span>')+'</td><td>'+tLink(t.to)+'</td><td class="num">'+(t.fee>0?money(t.fee):'—')+'</td><td class="num">'+(t.salary>0?money(t.salary)+'/wk':'—')+'</td></tr>').join('')+'</tbody></table>';}
  const log=[];D.matches.forEach(m=>{const p=m.picks.find(p=>p.athlete_id==id);if(p){const won=p.blue===m.blue_win;const opp=p.blue?m.red_team_id:m.blue_team_id;log.push({m,p,won,opp});}});
  if(log.length){h+='<h2>Match log</h2><table><thead><tr><th>Champion</th><th>Role</th><th>Opponent</th><th>Result</th></tr></thead><tbody>';
    log.forEach(x=>{h+='<tr><td>'+cLink(x.p.champion)+'</td><td>'+roleTag(x.p.position)+'</td><td>'+tLink(x.opp)+'</td><td class="'+(x.won?'win':'loss')+'"><a href="#/match/'+x.m.id+'">'+(x.won?'Win':'Loss')+'</a></td></tr>';});h+='</tbody></table>';}
  mount(h);}
// ===== Free Agents board: the unsigned-talent market, enabled by accurate team_id (null = no club). =====
function vFreeAgents(){const fa=D.athletes.filter(a=>a.team_id==null);
  let h=heroHeader('','Market','Free Agents','<b>'+fa.length+'</b> unsigned athletes · available to any club',
    [statCell('Available',fa.length),statCell('Avg age',fa.length?Math.round(fa.reduce((s,a)=>s+(a.age||0),0)/fa.length):'—'),statCell('Match-tested',fa.filter(a=>a.matches>0).length)]);
  if(!fa.length)return mount(h+'<p class="sub">No free agents — every athlete is under contract.</p>');
  h+='<p class="sub">click a column to sort · Overall = mean of the 12 attributes (a guide when there’s no match history)</p>'
    +'<table class="s"><thead><tr><th>Player</th><th>Best role</th><th data-num>Age</th><th data-num>Overall</th><th data-num>M</th><th data-num>Rating</th><th data-nosort>Recent champions</th></tr></thead><tbody>';
  fa.sort((a,b)=>ovr(b)-ovr(a)||(b.matches-a.matches));
  fa.forEach(a=>{const bp=bestPos(a),o=ovr(a);
    h+='<tr><td>'+aLink(a.id,40)+'</td><td data-s="'+(bp?bp.idx:9)+'">'+(bp?roleTag(bp.idx):'<span class="sub">—</span>')+'</td>'
      +'<td class="num">'+a.age+'</td><td class="num" data-s="'+o+'"><b>'+o+'</b></td><td class="num">'+a.matches+'</td><td class="num">'+avgRating(a.rating,a.matches)+'</td>'
      +'<td>'+((a.recent_champions||[]).slice(0,5).map(c=>'<a href="#/champion/'+encodeURIComponent(c)+'" title="'+esc(champName(c))+'">'+champIcon(c,24,true,'')+'</a>').join('')||'<span class="sub">—</span>')+'</td></tr>';});
  mount(h+'</tbody></table>');}
// Meta score = presence (pick+ban rate) lifted by win-rate over 50%.
function champMeta(c){if(!c.games||!c.picks)return null;const minGames=Math.max(3,c.games*0.03);if((c.picks+c.bans)<minGames)return null;
  const pres=100*(c.picks+c.bans)/c.games,wr=100*c.wins/c.picks;return {pres,wr,score:pres+(wr-50)};}
// Tiers are RELATIVE (quantile cut-offs) so they self-calibrate to roster size /
// game count instead of using absolute presence thresholds.
const TIER_CUTS=[['S',0.08],['A',0.25],['B',0.50],['C',0.80],['D',1.01]];
// ===== champion definitions (window.CHAMP_DATA from champ_data.js — hosted-site-only static
// game data: base stats + ability kits + descriptions). Absent in-game → kit sections hide. =====
function champDef(name){return (window.CHAMP_DATA&&window.CHAMP_DATA.info&&window.CHAMP_DATA.info[name])||null;}
function champDesc(name){return (window.CHAMP_DATA&&window.CHAMP_DATA.desc&&window.CHAMP_DATA.desc[name])||null;}
function champCat(c){const m=window.CHAMP_DATA&&window.CHAMP_DATA.cat;return (m&&m[String(c).toLowerCase()])||c;}
const CHAMP_STAT={attack:'Attack',hp:'HP',defence:'Armor',magic_resistance:'Magic Resist',magic_power:'Ability Power',move_speed:'Move Speed',crit_chance:'Crit Chance',hp_regen:'HP Regen'};
const CHAMP_STAT_ABBR={attack:'ATK',hp:'HP',defence:'ARM',magic_resistance:'MR',magic_power:'AP',move_speed:'MS',crit_chance:'CRIT',hp_regen:'REGEN'};
const ABIL_SLOTS=[['attack','Basic Attack',0],['skill','Skill 1',1],['skill2','Skill 2',2],['ult','Ultimate',3]];
const ABIL_EFFECTS=[['stun','Stun'],['airborne','Knock-up'],['knockback','Knockback'],['slow','Slow'],['shield','Shield'],['heal','Heal'],['silence','Silence'],['taunt','Taunt'],['fear','Fear'],['charm','Charm'],['bind','Root'],['banish','Banish'],['seal','Seal'],['invisible','Stealth'],['vamp','Lifesteal'],['lifesteal','Lifesteal'],['bleed','Bleed'],['burn','Burn'],['poison','Poison'],['dot','DoT']];
function abilEffects(a){const out=[],seen={},ks=Object.keys(a);for(const e of ABIL_EFFECTS){if(seen[e[1]])continue;if(ks.some(k=>k.indexOf(e[0])>=0)){out.push(e[1]);seen[e[1]]=1;if(out.length>=4)break;}}return out;}
// Fill the reliably-mappable placeholders (Damage/Coef/Range from the ability's own fields), strip the
// game's inline markup, and gracefully drop any remaining bespoke placeholder (game fills those via
// per-ability logic we can't reproduce) → an ellipsis so the prose never shows raw braces.
function resolveAbility(d,a){if(!d)return '';let t=String(d);
  const sub={Damage:a.attack,Coef:a.attack_ratio,Attack:a.attack,AttackRatio:a.attack_ratio,Range:a.range!=null?Math.round(a.range/1000):null,AttackRange:a.attack_range!=null?Math.round(a.attack_range/1000):null};
  for(const k in sub)if(sub[k]!=null)t=t.split('{'+k+'}').join(sub[k]);
  t=stripTags(t).replace(/\{[A-Za-z]+\}/g,'…');
  return t.replace(/\s+([.,)%])/g,'$1').replace(/\(\s+/g,'(').replace(/\s{2,}/g,' ').trim();}
function abilChips(a){const c=[];if(a.cooltime)c.push(['CD',(a.cooltime/60).toFixed(a.cooltime%60?1:0)+'s']);
  if(a.attack)c.push(['Power',a.attack]);if(a.attack_ratio)c.push(['Ratio',a.attack_ratio+'%']);if(a.range)c.push(['Range',Math.round(a.range/1000)]);return c;}
function vTierList(){const ranked=D.champions.map(c=>({c,m:champMeta(c)})).filter(x=>x.m).sort((a,b)=>b.m.score-a.m.score);
  if(ranked.length<2)return '';const n=ranked.length,buckets={};
  ranked.forEach((x,i)=>{const q=(i+1)/n,t=(TIER_CUTS.find(c=>q<=c[1])||TIER_CUTS[TIER_CUTS.length-1])[0];(buckets[t]=buckets[t]||[]).push(x);});
  let h='<h2>Tier list <small>presence + win-rate over last '+(D.champions[0]?D.champions[0].games:0)+' games · ranked vs the field</small></h2>';
  for(const [t] of TIER_CUTS){const row=buckets[t];if(!row||!row.length)continue;
    h+='<div class="tier"><span class="tlab tier-'+t+'">'+t+'</span><span class="tch">'+row.map(x=>'<span class="tchip" title="presence '+x.m.pres.toFixed(0)+'% · win '+x.m.wr.toFixed(0)+'%"><a href="#/champion/'+encodeURIComponent(x.c.name)+'">'+champIcon(x.c.name,30,true,'show')+esc(champName(x.c.name))+'</a></span>').join('')+'</span></div>';}
  return h;}
function vChampions(){const g=D.champions[0]?D.champions[0].games:0;
  // List ALL available champions (from the bundle defs), merged with match meta where it exists.
  let names=window.CHAMP_DATA&&window.CHAMP_DATA.info?Object.keys(window.CHAMP_DATA.info):[];
  D.champions.forEach(c=>{if(names.indexOf(c.name)<0)names.push(c.name);});
  if(!names.length)names=D.champions.map(c=>c.name);
  const rows=names.map(n=>champByName[n]||{name:n,picks:0,bans:0,wins:0,games:g});
  rows.sort((a,b)=>(b.picks+b.bans)-(a.picks+a.bans)||a.name.localeCompare(b.name));
  // champ_stats keys = available_champions = THIS season's pool. Partition so out-of-pool champions
  // (not pickable this season) don't sit in the meta tables as if they were live. Graceful: pool unknown → show all.
  const pool=poolKnown?rows.filter(c=>inPool(c.name)):rows;
  const off=poolKnown?names.filter(n=>!inPool(n)).sort((a,b)=>a.localeCompare(b)):[];
  const sub=poolKnown?('<b>'+pool.length+'</b> in this season’s pool · '+off.length+' not available · '):(rows.length+' champions · ');
  let h='<h1>Champions</h1><p class="sub">'+sub+'<a href="#/champ-stats">base stats &amp; patch watch →</a> · click a champion for its full kit · pick/ban/win over last '+g+' games</p>'+vTierList()
    +'<h2>Champion pool'+(poolKnown?' <small>'+pool.length+' active this season · click a column to sort</small>':'')+'</h2>'
    +'<table class="s"><thead><tr><th>Champion</th><th>Class</th><th data-num>Picks</th><th data-num>Pick%</th><th data-num>Bans</th><th data-num>Ban%</th><th data-num>Win%</th></tr></thead><tbody>';
  pool.forEach(c=>{const def=champDef(c.name);
    h+='<tr><td>'+cLink(c.name,40)+'</td><td class="sub">'+(def?esc(champCat(def.category)):'—')+'</td><td class="num">'+c.picks+'</td><td class="num" data-s="'+(c.games?c.picks/c.games:0)+'">'+(c.picks?pct(c.picks,c.games):'—')+'</td><td class="num">'+c.bans+'</td><td class="num" data-s="'+(c.games?c.bans/c.games:0)+'">'+(c.bans?pct(c.bans,c.games):'—')+'</td><td class="num" data-s="'+(c.picks?c.wins/c.picks:0)+'">'+(c.picks?pct(c.wins,c.picks):'—')+'</td></tr>';});
  h+='</tbody></table>';
  if(off.length)h+='<h2>Not available this season <small>'+off.length+' champions outside the pool</small></h2>'
    +'<div class="tier-band offpool">'+off.map(n=>'<a class="tband-chip" href="#/champion/'+encodeURIComponent(n)+'">'+champIcon(n,32,true,'show')+'<span>'+esc(champName(n))+'</span></a>').join('')+'</div>';
  mount(h);}
function vChampion(name){const c=champByName[name];const def=champDef(name);const dsc=champDesc(name);
  const live=champStatById[name];const cstat=live?live.stat:(def?def.stat:null),cgrowth=live?live.growth:(def?def.growth:null);
  // ----- champion card: portrait + identity + meta + base-stat pills (all in the hero) -----
  const meta=c?[['Games',c.games],['Pick%',pct(c.picks,c.games)],['Ban%',pct(c.bans,c.games)],['Win%',pct(c.wins,c.picks)]]:[];
  let pills='';
  if(cstat)pills=['attack','hp','defence','magic_resistance','magic_power','move_speed','crit_chance','hp_regen'].filter(f=>cstat[f]||(cgrowth&&cgrowth[f])).map(f=>{
    const cur=cstat[f]||0,base=(def&&def.stat&&def.stat[f])||0,d=cur-base;
    const delta=(live&&d)?'<span class="'+(d>0?'pos':'neg')+'" title="base-game '+base+'"> '+(d>0?'+':'')+d+'</span>':'';
    const g=(cgrowth&&cgrowth[f])?'<span class="sp-g" title="per level">+'+cgrowth[f]+'</span>':'';
    return '<div class="spill"><span class="sp-l">'+CHAMP_STAT_ABBR[f]+'</span><span class="sp-v">'+cur+delta+'</span>'+g+'</div>';}).join('');
  let h='<section class="chero"><div class="chero-art">'+champIcon(name,100,true,'bare')+'</div><div class="chero-body">'
    +'<div class="kick">Champion'+(live?' <span class="livetag">● live patch</span>':'')+'</div><h1>'+esc((dsc&&dsc.name)||champName(name))+'</h1>'
    +(def?'<div class="chero-class">'+esc(champCat(def.category))+(def.tags&&def.tags.length?'<span class="dot">·</span>'+def.tags.map(esc).join(' / '):'')+'</div>':'')
    +(meta.length?'<div class="chero-meta">'+meta.map(m=>'<div><span class="l">'+m[0]+'</span><span class="v">'+m[1]+'</span></div>').join('')+'</div>':'')
    +(pills?'<div class="chero-stats">'+pills+'</div>':'')
    +'</div></section>';
  if(def){h+='<h2>Abilities</h2><div class="kit">';
    ABIL_SLOTS.forEach(([slot,lbl,idx])=>{const a=def[slot];const gd=dsc&&dsc[slot];if(!a&&!gd)return;
      // Some skills are PASSIVES with no action object (only desc text + a top-level scalar, e.g. Ogre's
      // on-hit max-health gain) — render those from the description and tag them Passive, rather than
      // dropping the whole slot (which left a visible gap on Ogre, Monk, Gunner, Dancer, … — 13 champs).
      const d=gd?esc(resolveAbility(gd,a||{})):(slot==='attack'?('A standard '+(def.category?champCat(def.category).toLowerCase()+' ':'')+'auto-attack.'):'');
      const eff=a?abilEffects(a):['Passive'],chips=a?abilChips(a):[],ico=skillIcon(name,idx,30);
      h+='<div class="abil'+(slot==='ult'?' ult-card':'')+(a?'':' passive-card')+'"><div class="abil-h">'+(ico?'<span class="abil-ico">'+ico+'</span>':'')+'<span class="abil-slot '+slot+'">'+lbl+'</span>'+(eff.length?'<span class="abil-eff">'+eff.map(e=>'<span class="etag'+(e==='Passive'?' passive':'')+'">'+esc(e)+'</span>').join('')+'</span>':'')+'</div>'
        +(d?'<p class="abil-d">'+(gd?d:esc(d))+'</p>':'')
        +(chips.length?'<div class="abil-chips">'+chips.map(x=>'<span class="achip"><span class="al">'+x[0]+'</span><span class="aval">'+x[1]+'</span></span>').join('')+'</div>':'')+'</div>';});
    h+='</div>';}
  if(c){
    // this champion's picks across all matches (with win flag) — drives both role combat + item builds
    const cp=[];D.matches.forEach(m=>{const bw=m.blue_win;m.picks.forEach(p=>{if(p.champion==name)cp.push({p,won:p.blue===bw});});});
    const rmean=(arr,f)=>arr.length?arr.reduce((s,x)=>s+(x.p[f]||0),0)/arr.length:0;
    // most common full build within a set of picks → {items,n}
    const topBuild=ps=>{const cb={};ps.forEach(x=>{const a=x.p.items.slice().sort((p,q)=>p-q),k=a.join(',');if(!cb[k])cb[k]={items:a,n:0};cb[k].n++;});return Object.values(cb).sort((a,b)=>b.n-a.n)[0]||null;};
    // By role — combat (K/D, damage, CS) varies by role; the role's typical build is shown when the sample is usable (≥6).
    let rr='';for(let i=0;i<5;i++){if(c.role_picks[i]>0){const rp=cp.filter(x=>x.p.position===i),dmg=Math.round(rmean(rp,'deal'));
      const wi=rp.filter(x=>x.p.items&&x.p.items.length),tb=wi.length>=6?topBuild(wi):null;
      rr+='<tr><td>'+roleTag(i)+'</td><td class="num">'+c.role_picks[i]+'</td><td class="num">'+pct(c.role_wins[i],c.role_picks[i])+'</td><td class="num">'+rmean(rp,'kills').toFixed(1)+' / '+rmean(rp,'deaths').toFixed(1)+'</td><td class="num" data-s="'+dmg+'">'+dmg.toLocaleString()+'</td><td class="num">'+rmean(rp,'cs').toFixed(0)+'</td><td class="bcell"'+(tb?' title="'+esc(tb.items.map(itemName).join(' + ')+' · '+tb.n+'/'+wi.length+' games')+'"':'')+'>'+(tb?tb.items.map(x=>itemChip(x,22)).join(''):'<span class="sub">varies</span>')+'</td></tr>';}}
    if(rr)h+='<h2>By role</h2><table class="s"><thead><tr><th>Role</th><th data-num>Picks</th><th data-num>Win%</th><th data-num>Avg K/D</th><th data-num>Avg DMG</th><th data-num>Avg CS</th><th data-nosort>Typical build</th></tr></thead><tbody>'+rr+'</tbody></table>';
    // Role specialists — who plays this champion MOST in each role (the go-to player), record shown as context.
    // (Most-games is stable; ranking by win% over a 2-game min would surface noisy 0–2 "bests".)
    let spec='';for(let i=0;i<5;i++){const rp=cp.filter(x=>x.p.position===i);if(rp.length<2)continue;
      const byA={};rp.forEach(x=>{const a=(byA[x.p.athlete_id]=byA[x.p.athlete_id]||{g:0,w:0,net:0});a.g++;if(x.won)a.w++;a.net+=(x.p.kills-x.p.deaths);});
      const best=Object.entries(byA).filter(e=>e[1].g>=2).sort((A,B)=>(B[1].g-A[1].g)||(B[1].w/B[1].g-A[1].w/A[1].g)||(B[1].net-A[1].net))[0];
      if(best){const id=+best[0],a=best[1];spec+='<div class="spec"><span class="spec-r">'+roleTag(i)+'</span><a class="spec-p" href="#/player/'+id+'">'+avatar(id,30)+'<span>'+esc((athById[id]||{}).name||('#'+id))+'</span></a><span class="spec-rec">'+a.g+'g <span class="sub">'+a.w+'–'+(a.g-a.w)+'</span></span></div>';}}
    if(spec)h+='<h2>Role specialists <small>who plays '+esc(champName(name))+' most in each role · min 2 games</small></h2><div class="specs">'+spec+'</div>';
    // Item builds — the most common item combinations (3-item sets) and signature items, with win rate.
    const withI=cp.filter(x=>x.p.items&&x.p.items.length);
    if(withI.length>=4){
      const itf={};withI.forEach(x=>new Set(x.p.items).forEach(i=>itf[i]=(itf[i]||0)+1)); // core items by per-game PRESENCE (items can stack within a build → dedupe per game so % ≤ 100; stacking still shows in the builds below)
      const core=Object.entries(itf).map(([i,n])=>[+i,n]).sort((a,b)=>b[1]-a[1]).slice(0,6);
      const cb={};withI.forEach(x=>{const arr=x.p.items.slice().sort((a,b)=>a-b),k=arr.join(',');if(!cb[k])cb[k]={items:arr,n:0,w:0};cb[k].n++;if(x.won)cb[k].w++;});
      const builds=Object.values(cb).sort((a,b)=>b.n-a.n).filter(b=>b.n>=2).slice(0,3); // full builds, ≥2 games
      h+='<h2>Item builds <small>signature items &amp; combinations across '+withI.length+' games</small></h2>';
      h+='<div class="coreitems">'+core.map(([i,n])=>'<span class="ci" title="'+esc(itemName(i))+' · in '+pct(n,withI.length)+' of games">'+itemChip(i,32)+'<b>'+pct(n,withI.length)+'</b></span>').join('')+'</div>';
      if(builds.length)h+='<div class="builds">'+builds.map((b,idx)=>'<div class="bld'+(idx===0?' top':'')+'"><div class="bld-i">'+b.items.map(i=>itemChip(i,34)).join('')+'</div><div class="bld-m"><span class="bld-share">'+pct(b.n,withI.length)+'</span><span class="bld-sub">'+b.n+' games · '+pct(b.w,b.n)+' win</span></div></div>').join('')+'</div>';
      // Item impact — win-rate swing WITH vs WITHOUT each item (swing items only; core items have no "without" sample).
      const totW=withI.filter(x=>x.won).length,used={};withI.forEach(x=>new Set(x.p.items).forEach(i=>used[i]=1));
      const imp=Object.keys(used).map(i=>{i=+i;let gw=0,ww=0;withI.forEach(x=>{if(x.p.items.indexOf(i)>=0){gw++;if(x.won)ww++;}});const gwo=withI.length-gw,wwo=totW-ww;
        return {i,gw,wrW:gw?100*ww/gw:0,delta:(gw?100*ww/gw:0)-(gwo?100*wwo/gwo:0)};}).filter(o=>o.gw>=3&&(withI.length-o.gw)>=3).sort((a,b)=>b.delta-a.delta);
      if(imp.length){const show=imp.length<=5?imp:[...imp.slice(0,3),...imp.slice(-2)];
        h+='<h3 class="ibh">Item impact <small>win rate with vs without · swing items only</small></h3><div class="impact">'+show.map(o=>'<div class="imp"><span class="imp-i">'+itemChip(o.i,26)+'</span><span class="imp-n">'+esc(itemName(o.i))+'</span><span class="imp-wr">'+o.wrW.toFixed(0)+'% win<span class="sub"> · '+o.gw+'g</span></span><span class="imp-d '+(o.delta>=0?'pos':'neg')+'" title="win-rate swing vs games without this item">'+(o.delta>=0?'+':'')+o.delta.toFixed(0)+'</span></div>').join('')+'</div>';}
    }
    // Synergies & matchups — co-pick (SAME side) and versus (OPPOSITE side) win rates from full match context.
    const syn={},synW={},cnt={},cntW={};
    D.matches.forEach(m=>{const bw=m.blue_win,blue=m.picks.filter(p=>p.blue),red=m.picks.filter(p=>!p.blue);
      [[blue,red,bw],[red,blue,!bw]].forEach(a=>{const side=a[0],opp=a[1],won=a[2];if(!side.some(p=>p.champion==name))return;
        side.forEach(p=>{if(p.champion==name)return;syn[p.champion]=(syn[p.champion]||0)+1;if(won)synW[p.champion]=(synW[p.champion]||0)+1;});
        opp.forEach(p=>{cnt[p.champion]=(cnt[p.champion]||0)+1;if(won)cntW[p.champion]=(cntW[p.champion]||0)+1;});});});
    const minPair=Math.max(4,Math.round(cp.length*0.06)),wrCls=w=>w>=53?'win':w<=47?'loss':'';
    const synR=Object.keys(syn).filter(k=>syn[k]>=minPair).map(k=>({c:k,n:syn[k],w:100*(synW[k]||0)/syn[k]})).sort((a,b)=>b.w-a.w);
    const cntR=Object.keys(cnt).filter(k=>cnt[k]>=minPair).map(k=>({c:k,n:cnt[k],w:100*(cntW[k]||0)/cnt[k]})).sort((a,b)=>b.w-a.w);
    if(synR.length)h+='<h2>Synergies <small>'+esc(champName(name))+'’s win rate when paired · ≥'+minPair+' games</small></h2><table class="s"><thead><tr><th>Teammate</th><th data-num>Together</th><th data-num>Win%</th></tr></thead><tbody>'
      +synR.slice(0,8).map(x=>'<tr><td>'+cLink(x.c,32)+'</td><td class="num">'+x.n+'</td><td class="num '+wrCls(x.w)+'">'+x.w.toFixed(0)+'%</td></tr>').join('')+'</tbody></table>';
    if(cntR.length)h+='<h2>Matchups <small>'+esc(champName(name))+'’s win rate vs · favorable (top) → counters (bottom) · ≥'+minPair+' games</small></h2><table class="s"><thead><tr><th>Opponent</th><th data-num>Faced</th><th data-num>Win%</th></tr></thead><tbody>'
      +cntR.map(x=>'<tr><td>'+cLink(x.c,32)+'</td><td class="num">'+x.n+'</td><td class="num '+wrCls(x.w)+'">'+x.w.toFixed(0)+'%</td></tr>').join('')+'</tbody></table>';
  }
  const players={};D.matches.forEach(m=>m.picks.forEach(p=>{if(p.champion==name)players[p.athlete_id]=(players[p.athlete_id]||0)+1;}));
  const pr=Object.entries(players).sort((a,b)=>b[1]-a[1]);
  if(pr.length){h+='<h2>Played by</h2><table><thead><tr><th>Player</th><th data-num>Games</th></tr></thead><tbody>'+pr.map(e=>'<tr><td>'+aLink(e[0])+'</td><td class="num">'+e[1]+'</td></tr>').join('')+'</tbody></table>';}
  mount(h);}
// ===== Base stats & Patch Watch: surface the LIVE champion stats (champ_stats, from the running
// game) for the active pool, and diff them against the base game to show buffs/nerfs. =====
const CSTAT_FIELDS=['attack','hp','defence','magic_resistance','magic_power','move_speed','crit_chance','hp_regen'];
function vChampStats(){const pool=(D.champ_stats||[]).slice();
  if(!pool.length)return mount('<h1>Champion base stats</h1><p class="sub">Live champion stats aren’t in this data yet — load a game on the current build. <a href="#/champions">← Champions</a></p>');
  // Patch Watch: live (champ_stats) vs base game (champDef) — collect every changed stat/growth.
  const changes=[];
  pool.forEach(c=>{const def=champDef(c.id);if(!def||!def.stat)return;const ds=[];
    CSTAT_FIELDS.forEach(f=>{const cur=c.stat[f]||0,base=def.stat[f]||0;if(cur!==base)ds.push({f,base,cur,d:cur-base});
      const gb=(def.growth&&def.growth[f])||0,gc=(c.growth&&c.growth[f])||0;if(gc!==gb)ds.push({f,base:gb,cur:gc,d:gc-gb,g:1});});
    if(ds.length)changes.push({id:c.id,ds});});
  let h=heroHeader('','Champions','Base stats & patch watch','Live champion base stats from the running game · '+pool.length+' champions in the pool',
    [statCell('In pool',pool.length),statCell('Changed',changes.length,changes.length?'pos':'')]);
  h+='<p class="sub"><a href="#/champions">← back to the meta</a></p><h2>Patch Watch</h2>';
  if(changes.length)h+='<div class="pwatch">'+changes.map(ch=>'<a class="pw-card" href="#/champion/'+encodeURIComponent(ch.id)+'">'+champIcon(ch.id,34,true,'show')
    +'<div class="pw-b"><span class="pw-n">'+esc(champName(ch.id))+'</span><span class="pw-d">'
    +ch.ds.map(x=>'<span class="'+(x.d>0?'pos':'neg')+'">'+CHAMP_STAT_ABBR[x.f]+' '+(x.g?'+'+x.base+'→+'+x.cur+'/lv':x.base+'→'+x.cur)+' ('+(x.d>0?'+':'')+x.d+')</span>').join('')
    +'</span></div></a>').join('')+'</div>';
  else h+='<p class="sub">No balance changes this patch — every live value matches the base game. This board lights up the moment a champion is buffed or nerfed.</p>';
  h+='<h2>Base stats <small>live values · growth per level · click a column to sort</small></h2><table class="s"><thead><tr><th>Champion</th><th>Class</th>'
    +CSTAT_FIELDS.map(f=>'<th data-num>'+CHAMP_STAT_ABBR[f]+'</th>').join('')+'</tr></thead><tbody>';
  pool.sort((a,b)=>(b.stat.hp||0)-(a.stat.hp||0));
  pool.forEach(c=>{const def=champDef(c.id);
    h+='<tr><td>'+cLink(c.id,32)+'</td><td class="sub">'+(def?esc(champCat(def.category)):'—')+'</td>'
      +CSTAT_FIELDS.map(f=>{const v=c.stat[f]||0,gw=(c.growth&&c.growth[f])||0;return '<td class="num" data-s="'+v+'">'+v+(gw?'<span class="sp-g" title="per level">+'+gw+'</span>':'')+'</td>';}).join('')+'</tr>';});
  mount(h+'</tbody></table>');}
// item id -> array index into D.items (for itemIcon / pick.items membership).
function itemIdx(id){return D.items?D.items.indexOf(id):-1;}
// small name+icon link to an item page (used in build paths).
function itemLink(id){const i=itemIdx(id),ic=i>=0?itemIcon(i,22):'',nm=(window.ITEM_DATA&&window.ITEM_DATA[id]&&window.ITEM_DATA[id].name)||champName(id);
  return '<a class="ilink" href="#/item/'+encodeURIComponent(id)+'" data-item="'+esc(id)+'">'+(ic?'<span class="ichip">'+ic+'</span>':'')+esc(nm)+'</a>';}
// ===== Items: a browsable shop reference (stats/effects/tiers/build paths) + per-item detail. =====
function vItems(){const ID=window.ITEM_DATA;
  let h=heroHeader('','Reference','Items','The full item shop · stats, effects, tiers &amp; build paths',
    [statCell('Items',ID?Object.keys(ID).length:(D.items||[]).length)]);
  if(!ID){return mount(h+'<p class="sub">Detailed item data isn’t available here.</p><div class="chips">'+(D.items||[]).map((k,i)=>'<span>'+itemChip(i,24)+' '+esc(itemName(i))+'</span>').join('')+'</div>');}
  h+='<p class="sub">click an item for full details · hover any icon for a quick view</p>';
  const byTier={};Object.keys(ID).forEach(id=>{(byTier[ID[id].tier]=byTier[ID[id].tier]||[]).push(id);});
  Object.keys(byTier).map(Number).sort((a,b)=>a-b).forEach(t=>{
    const list=byTier[t].sort((a,b)=>ID[a].price-ID[b].price||ID[a].name.localeCompare(ID[b].name));
    h+='<h2>Tier '+t+' <small>'+list.length+' items</small></h2><div class="itemgrid">'+list.map(id=>{const d=ID[id],i=itemIdx(id);
      return '<a class="icard" href="#/item/'+encodeURIComponent(id)+'" data-item="'+esc(id)+'"><span class="icard-ic">'+(i>=0?itemIcon(i,34):'')+'</span><span class="icard-b"><span class="icard-n">'+esc(d.name)+'</span><span class="icard-s">'+esc(d.cat)+' · $'+d.price.toLocaleString()+'</span></span></a>';}).join('')+'</div>';});
  mount(h);}
function vItem(id){const ID=window.ITEM_DATA,d=ID&&ID[id],i=itemIdx(id);
  const name=d?d.name:(i>=0?itemName(i):champName(id));
  const art=i>=0?'<span class="iart">'+itemIcon(i,72)+'</span>':'';
  const stats=d?[statCell('Tier',d.tier),statCell('Price','$'+(d.price||0).toLocaleString()),statCell('Class',d.cat||'—')]:[];
  let h=heroHeader(art,'Item',esc(name),'',stats);
  if(d){
    if(d.stats&&d.stats.length)h+='<h2>Stats</h2><ul class="itip-st big">'+d.stats.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>';
    if(d.option)h+='<h2>Effect</h2><p class="item-eff">'+esc(d.option)+'</p>';
    const from=ID?Object.keys(ID).filter(x=>(ID[x].into||[]).indexOf(id)>=0):[];
    if(from.length||(d.into&&d.into.length)){h+='<h2>Build path</h2><div class="bpath">'
      +(from.length?'<div><span class="bp-l">Builds from</span> '+from.map(itemLink).join(' '):'')+(from.length?'</div>':'')
      +(d.into&&d.into.length?'<div><span class="bp-l">Builds into</span> '+d.into.map(itemLink).join(' ')+'</div>':'')+'</div>';}
  } else h+='<p class="sub">Detailed stats aren’t available here.</p>';
  // Most built by — which champions buy this item most (ties items into the meta).
  if(i>=0){const byCh={},wonByCh={};let tot=0;
    D.matches.forEach(m=>{const bw=m.blue_win;m.picks.forEach(p=>{if((p.items||[]).indexOf(i)>=0){byCh[p.champion]=(byCh[p.champion]||0)+1;if(p.blue===bw)wonByCh[p.champion]=(wonByCh[p.champion]||0)+1;tot++;}});});
    const rows=Object.entries(byCh).sort((a,b)=>b[1]-a[1]).slice(0,12);
    if(rows.length)h+='<h2>Most built by <small>'+tot+' purchases in recent games</small></h2><table class="s"><thead><tr><th>Champion</th><th data-num>Builds</th><th data-num>Win%</th></tr></thead><tbody>'
      +rows.map(([c,n])=>'<tr><td>'+cLink(c,32)+'</td><td class="num">'+n+'</td><td class="num">'+pct(wonByCh[c]||0,n)+'</td></tr>').join('')+'</tbody></table>';}
  mount(h);}
function decodeRef(s,comp){let m;s=String(s);
  if(m=s.match(/^Normal\((\d+)\)/))return tLink(+m[1]);
  if(m=s.match(/^CompetitionRank\(\d+,\s*(\d+)\)/)){const r=+m[1],st=comp&&comp.standings[r-1];return 'Seed '+r+(st?' · '+tLink(st.team_id):'');}
  if(m=s.match(/^WinnerOf\((\d+)\)/))return '<span class="sub">Winner of M'+m[1]+'</span>';
  if(m=s.match(/^LoserOf\((\d+)\)/))return '<span class="sub">Loser of M'+m[1]+'</span>';
  return esc(s);}
function schedRow(m,comp){const aW=m.done&&m.aw>m.bw,bW=m.done&&m.bw>m.aw;
  const t1=(m.done&&m.a!=null)?tLink(m.a):decodeRef(m.t1,comp),t2=(m.done&&m.b!=null)?tLink(m.b):decodeRef(m.t2,comp);
  const mid=m.done?'<b>'+m.aw+'–'+m.bw+'</b>':'<span class="sub">vs</span>';
  const last=m.done?(m.rep!=null?'<a href="#/match/'+m.rep+'">view</a>':''):'<span class="sub">'+(m.need_win>0?'Bo'+(m.need_win*2-1):'')+'</span>';
  return '<tr><td class="sub">'+esc(m.date)+'</td><td style="text-align:right"'+(aW?' class="win"':'')+'>'+t1+'</td><td class="num">'+mid+'</td><td'+(bW?' class="win"':'')+'>'+t2+'</td><td>'+last+'</td></tr>';}
function schedTable(list,comp){return '<table class="s"><thead><tr><th>Date</th><th style="text-align:right">Team</th><th data-nosort></th><th>Team</th><th data-nosort></th></tr></thead><tbody>'+list.map(m=>schedRow(m,comp)).join('')+'</tbody></table>';}
function vLeagues(){let h='<h1>Leagues</h1><p class="sub">click a column to sort · cross-league comparison · '+D.leagues.length+' leagues</p>';
  h+='<table class="s"><thead><tr><th>League</th><th data-num>Div</th><th data-num>Teams</th><th>Leader</th><th data-num>Prize pool</th><th data-num>Total fans</th><th data-num>Avg balance</th></tr></thead><tbody>';
  D.leagues.forEach(l=>{const tm=D.teams.filter(t=>t.league_id==l.id);const comp=(compsByLeague[l.id]||[])[0];
    const leader=comp&&comp.standings[0]?comp.standings[0].team_id:null;
    const prize=(l.prize_pool||[]).reduce((a,b)=>a+b,0),fans=tm.reduce((a,t)=>a+(t.fan_count||0),0),bal=tm.length?tm.reduce((a,t)=>a+(t.balance||0),0)/tm.length:0;
    h+='<tr><td>'+lLink(l.id)+'</td><td class="num">'+(l.division??'')+'</td><td class="num">'+tm.length+'</td><td>'+(leader!=null?tLink(leader):'—')+'</td><td class="num" data-s="'+prize+'">'+money(prize)+'</td><td class="num" data-s="'+fans+'">'+fans.toLocaleString()+'</td><td class="num" data-s="'+bal+'">'+money(bal)+'</td></tr>';});
  mount(h+'</tbody></table>');}
function vLeague(id){const l=leagueById[id];if(!l)return mount('<h1>League not found</h1>');
  const tmAll=D.teams.filter(t=>t.league_id==id);const comp0=(compsByLeague[id]||[])[0];
  const leader=comp0&&comp0.standings[0]?comp0.standings[0].team_id:null;
  const stats=[statCell('Division',l.division??'?'),statCell('Teams',tmAll.length),statCell('Prize pool',money((l.prize_pool||[]).reduce((a,b)=>a+b,0)))];
  let h=heroHeader(badge(initials(lgName(l)),hue(l.name),'crest',74),'League',esc(lgName(l)),
    leader!=null?'Leader: '+tLink(leader):null,stats);
  (compsByLeague[l.id]||[]).forEach(c=>{h+='<h2>Standings</h2><table class="s"><thead><tr><th data-nosort>#</th><th>Team</th><th data-num>Pts</th><th data-num>W</th><th data-num>L</th><th data-num>Win%</th><th data-nosort>Trend</th></tr></thead><tbody>';
    c.standings.forEach((s,i)=>{const tt=teamById[s.team_id];h+='<tr'+(i===0?' class="lead"':'')+'><td class="'+(i<3?'r'+(i+1):'')+'">'+(i+1)+'</td><td>'+tLink(s.team_id)+'</td><td class="num"><b>'+s.points+'</b></td><td class="num">'+s.win+'</td><td class="num">'+s.lose+'</td><td class="num">'+pct(s.win,s.win+s.lose)+'</td><td>'+spark(tt&&tt.rank_hist,true,90,22)+'</td></tr>';});h+='</tbody></table>';});
  (compsByLeague[l.id]||[]).forEach(c=>{
    if(c.bracket&&c.bracket.length)h+='<h2>Playoffs</h2>'+schedTable(c.bracket,c);
    if(c.sched&&c.sched.length){const played=c.sched.filter(m=>m.done).length;h+='<h2>Schedule <small>'+played+'/'+c.sched.length+' played</small></h2>'+schedTable(c.sched,c);}});
  const inL=D.athletes.filter(a=>a.team_id!=null&&teamById[a.team_id]&&teamById[a.team_id].league_id==id&&a.matches>0);
  if(inL.length){const byR=[...inL].sort((a,b)=>(b.rating/(b.matches*10))-(a.rating/(a.matches*10))).slice(0,10);
    h+='<h2>Rating leaders</h2><table class="s"><thead><tr><th>Player</th><th>Team</th><th data-num>M</th><th data-num>Rating</th><th data-num>KDA</th><th data-num>MVP</th></tr></thead><tbody>'+
      byR.map(a=>'<tr><td>'+aLink(a.id)+'</td><td>'+tLink(a.team_id)+'</td><td class="num">'+a.matches+'</td><td class="num">'+avgRating(a.rating,a.matches)+'</td><td class="num">'+(a.deaths?((a.kills+a.assists)/a.deaths).toFixed(2):'∞')+'</td><td class="num">'+a.mvp+'</td></tr>').join('')+'</tbody></table>';}
  const inLg=tid=>teamById[tid]&&teamById[tid].league_id==id;
  const ms=D.matches.filter(m=>inLg(m.blue_team_id)||inLg(m.red_team_id));
  if(ms.length){const pk={},bn={},wn={};
    ms.forEach(m=>{const bL=inLg(m.blue_team_id),rL=inLg(m.red_team_id);
      m.picks.forEach(p=>{if(p.blue?!bL:!rL)return;pk[p.champion]=(pk[p.champion]||0)+1;if(p.blue===m.blue_win)wn[p.champion]=(wn[p.champion]||0)+1;});
      if(bL)(m.blue_bans||[]).forEach(b=>bn[b]=(bn[b]||0)+1);if(rL)(m.red_bans||[]).forEach(b=>bn[b]=(bn[b]||0)+1);});
    const rows=[...new Set([...Object.keys(pk),...Object.keys(bn)])].map(n=>({n,p:pk[n]||0,b:bn[n]||0,w:wn[n]||0})).sort((a,b)=>(b.p+b.b)-(a.p+a.b)).slice(0,20);
    if(rows.length)h+='<h2>Champion meta <small>'+ms.length+' recent league games</small></h2><table class="s"><thead><tr><th>Champion</th><th data-num>Picks</th><th data-num>Bans</th><th data-num>Win%</th></tr></thead><tbody>'+
      rows.map(c=>'<tr><td>'+cLink(c.n)+'</td><td class="num">'+c.p+'</td><td class="num">'+c.b+'</td><td class="num">'+pct(c.w,c.p)+'</td></tr>').join('')+'</tbody></table>';}
  const tm=D.teams.filter(t=>t.league_id==id);
  h+='<h2>Teams</h2><table class="s"><thead><tr><th>Team</th><th>Manager</th><th data-num>Fans</th><th data-num>Balance</th></tr></thead><tbody>'+
    tm.map(t=>'<tr><td>'+tLink(t.id)+'</td><td>'+esc(t.manager)+'</td><td class="num" data-s="'+t.fan_count+'">'+t.fan_count.toLocaleString()+'</td><td class="num" data-s="'+t.balance+'">'+money(t.balance)+'</td></tr>').join('')+'</tbody></table>';
  mount(h);}
function vMatches(){let h='<h1>Recent Matches</h1><table class="s"><thead><tr><th data-nosort>#</th><th>Blue</th><th data-nosort></th><th>Red</th><th>Winner</th></tr></thead><tbody>';
  D.matches.forEach((m,i)=>{h+='<tr><td>'+(i+1)+'</td><td class="'+(m.blue_win?'win':'')+'">'+tLink(m.blue_team_id)+'</td><td class="sub">vs</td><td class="'+(!m.blue_win?'win':'')+'">'+tLink(m.red_team_id)+'</td><td><a href="#/match/'+m.id+'">'+esc(tName(m.blue_win?m.blue_team_id:m.red_team_id))+'</a></td></tr>';});
  mount(h+'</tbody></table>');}
function vMatch(id){const m=D.matches.find(x=>x.id==id);if(!m)return mount('<h1>Match not found</h1>');
  const bw=m.blue_win,bp=m.blue_perf||{},rp=m.red_perf||{};
  let h='<h1>'+tLink(m.blue_team_id,40)+' <span class="sub">vs</span> '+tLink(m.red_team_id,40)+'</h1>';
  h+='<p class="sub">Winner: <b class="win">'+esc(tName(bw?m.blue_team_id:m.red_team_id))+'</b></p>';
  // Team performance comparison (blue | metric | red); bigger value highlighted.
  const prow=(label,f,fmt)=>{fmt=fmt||(v=>v==null?'—':(+v).toLocaleString());const a=bp[f],b=rp[f];
    return '<tr><td class="num'+(a>b?' win':'')+'">'+fmt(a)+'</td><td class="sub" style="text-align:center">'+label+'</td><td class="num'+(b>a?' win':'')+'">'+fmt(b)+'</td></tr>';};
  h+='<h2>Team performance</h2><table><thead><tr><th class="num">'+esc(tName(m.blue_team_id))+(bw?' ✓':'')+'</th><th class="sub" style="text-align:center"></th><th class="num">'+esc(tName(m.red_team_id))+(!bw?' ✓':'')+'</th></tr></thead><tbody>'+
    prow('Kills','kills')+prow('Deaths','deaths')+prow('Damage','deal')+prow('Total gold','total_gold',money)+prow('Gold @ laning','gold_lane',money)+prow('CS @ laning','cs_lane')+'</tbody></table>';
  h+='<div class="kv"><div>'+esc(tName(m.blue_team_id))+' bans <b>'+((m.blue_bans||[]).map(b=>esc(champName(b))).join(', ')||'—')+'</b></div><div>'+esc(tName(m.red_team_id))+' bans <b>'+((m.red_bans||[]).map(b=>esc(champName(b))).join(', ')||'—')+'</b></div></div>';
  const side=b=>{const ps=m.picks.filter(p=>p.blue==b).sort((x,y)=>x.position-y.position);
    return '<h2>'+tLink(b?m.blue_team_id:m.red_team_id,28)+(b===bw?' <span class="win">(won)</span>':'')+'</h2><table><thead><tr><th>Role</th><th>Player</th><th>Champion</th><th class="num">K</th><th class="num">D</th><th class="num">Dmg</th><th class="num">CS</th><th>Items</th></tr></thead><tbody>'+
      ps.map(p=>'<tr><td>'+roleTag(p.position)+'</td><td>'+aLink(p.athlete_id,40)+'</td><td>'+cLink(p.champion,40)+'</td><td class="num">'+(p.kills||0)+'</td><td class="num">'+(p.deaths||0)+'</td><td class="num">'+(p.deal||0).toLocaleString()+'</td><td class="num">'+(p.cs||0)+'</td><td class="chips">'+((p.items||[]).map(i=>itemChip(i,26)).join('')||'<span class="sub">—</span>')+'</td></tr>').join('')+'</tbody></table>';};
  mount(h+side(true)+side(false));}
// ===== Newsroom: synthesized "reporter" stories from the exported data =====
function teamRank(tid){for(const c of D.competitions){const i=c.standings.findIndex(s=>s.team_id==tid);if(i>=0)return {rank:i+1,n:c.standings.length,s:c.standings[i]};}return null;}
function teamForm(tid,n){const r=[];for(const m of D.matches){if(m.blue_team_id==tid||m.red_team_id==tid){r.push((m.blue_team_id==tid)===m.blue_win);if(r.length>=n)break;}}return r;}
function streak(f){if(!f.length)return '';let s=1;for(let i=1;i<f.length;i++){if(f[i]===f[0])s++;else break;}return s>=2?(s+(f[0]?'-game win streak':'-game skid')):'';}
function deskResults(limit){
  // Drive off the SCHEDULE's completed series (authoritative aw/bw the mod resolved from
  // MatchInfo.replays) — replays alone can't be grouped into series client-side (no parent-match
  // id), which made single-game "X stun Y" headlines that contradicted the game-wire's series result.
  const done=[],seen={};
  D.competitions.forEach(c=>{(c.sched||[]).concat(c.bracket||[]).forEach(m=>{
    if(!m.done||m.a==null||m.b==null||seen[m.id])return;seen[m.id]=1;done.push(m);});});
  const cand=done.map(m=>{
    const aWon=m.aw>=m.bw,wT=aWon?m.a:m.b,lT=aWon?m.b:m.a,ws=Math.max(m.aw,m.bw),ls=Math.min(m.aw,m.bw);
    let kd=0,gd=0,mvp=null,best=-1; // flavour from the winner's won games between these two teams
    h2hGames(wT,lT).forEach(g=>{if((g.blue_win?g.blue_team_id:g.red_team_id)!==wT)return;
      const wp=g.blue_win?(g.blue_perf||{}):(g.red_perf||{}),lp=g.blue_win?(g.red_perf||{}):(g.blue_perf||{});
      kd+=(wp.kills||0)-(lp.kills||0);gd+=(wp.total_gold||0)-(lp.total_gold||0);
      g.picks.filter(p=>p.blue===g.blue_win).forEach(p=>{const v=(p.kills||0)*2+(p.deal||0)/1500-(p.deaths||0);if(v>best){best=v;mvp=p;}});});
    const wR=teamRank(wT),lR=teamRank(lT),upset=!!(wR&&lR&&wR.rank>=lR.rank+3),sweep=ls===0&&ws>=2;
    return {rep:m.rep,wT,lT,ws,ls,kd,gd,upset,sweep,mvp,score:(upset?120:0)+(sweep?20:0)+kd*3+gd/1200};});
  const UPV=['stun','shock','topple','ambush'],DOMV=['demolish','dismantle','run over','steamroll'],EDGV=['edge','squeak past','outlast','hold off'];
  const UPB=['pulled off the upset against','sent shockwaves through the league by beating','had no business beating — yet took down','pulled the rug out from under'];
  const pk=(arr,i)=>arr[i%arr.length];
  return cand.sort((a,b)=>b.score-a.score).slice(0,limit).map((s,i)=>{
    const w=tName(s.wT),l=tName(s.lT),sl=s.ws+'–'+s.ls,dom=s.sweep||s.kd>=10;
    const head=(s.upset?(w+' '+pk(UPV,i)+' '+l):(w+' '+pk(dom?DOMV:EDGV,i)+' '+l))+' '+sl;
    let blurb=(s.upset?(w+' '+pk(UPB,i)+' '+l):(w+' '+(dom?'overpowered':'got past')+' '+l))+' '+sl;
    if(s.mvp){const a=athById[s.mvp.athlete_id];blurb+=', powered by '+(a?a.name:'a standout')+'’s '+(s.mvp.kills||0)+' kills on '+champName(s.mvp.champion);}
    return {head,blurb:blurb+'.',tag:s.upset?'Upset':'Result',cls:s.upset?'up':'',link:(s.rep!=null?'#/match/'+s.rep:'#/matches'),score:s.score,desk:'Results'};});
}
function deskStandings(limit){const out=[];
  D.leagues.forEach(l=>{const c=(compsByLeague[l.id]||[])[0];if(c&&c.standings[0]){const s=c.standings[0],st=streak(teamForm(s.team_id,6));
    out.push({head:tName(s.team_id)+' top '+lgName(l),blurb:tName(s.team_id)+' sit atop '+lgName(l)+' at '+s.win+'–'+s.lose+(st?', riding a '+st:'')+'.',tag:'Standings',link:'#/league/'+l.id,score:40+s.points/5,desk:'Standings'});}});
  D.teams.forEach(t=>{if(t.rank_hist&&t.rank_hist.length>=2){const cur=t.rank_hist[t.rank_hist.length-1],d=t.rank_hist[t.rank_hist.length-2]-cur;if(Math.abs(d)>=2)
    out.push({head:tName(t.id)+(d>0?' on the rise':' stumbling'),blurb:tName(t.id)+' '+(d>0?'climbed':'dropped')+' '+Math.abs(d)+' place'+(Math.abs(d)>1?'s':'')+' to #'+cur+' in the table.',tag:'Mover',cls:d>0?'up':'',link:'#/team/'+t.id,score:55+Math.abs(d)*4,desk:'Standings'});}});
  return out.sort((a,b)=>b.score-a.score).slice(0,limit);}
function deskMeta(limit){const out=[];const g=D.champions[0]?D.champions[0].games:0;if(!g)return out;const minS=Math.max(3,g*0.05);
  const b=[...D.champions].sort((x,y)=>y.bans-x.bans)[0];if(b&&b.bans>0)out.push({head:champName(b.name)+' rules the ban phase',blurb:champName(b.name)+' is the most-contested champion, removed in '+pct(b.bans,g)+' of drafts over the last '+g+' games.',tag:'Meta',link:'#/champion/'+encodeURIComponent(b.name),score:85,desk:'Meta Watch'});
  const wr=D.champions.filter(c=>c.picks>=minS).sort((x,y)=>(y.wins/y.picks)-(x.wins/x.picks))[0];if(wr)out.push({head:champName(wr.name)+' is quietly dominating',blurb:champName(wr.name)+' holds a '+pct(wr.wins,wr.picks)+' win rate across '+wr.picks+' games — best among regulars.',tag:'Meta',link:'#/champion/'+encodeURIComponent(wr.name),score:75,desk:'Meta Watch'});
  const p=[...D.champions].sort((x,y)=>y.picks-x.picks)[0];if(p&&(!wr||p.name!==wr.name))out.push({head:champName(p.name)+' is the meta staple',blurb:champName(p.name)+' leads in raw picks ('+p.picks+'), a near-permanent fixture of team comps.',tag:'Meta',link:'#/champion/'+encodeURIComponent(p.name),score:65,desk:'Meta Watch'});
  return out.slice(0,limit);}
function deskPlayers(limit){const out=[];const e=D.athletes.filter(a=>a.matches>=3);
  const por=[...e].sort((a,b)=>(b.rating/(b.matches*10))-(a.rating/(a.matches*10)))[0];
  if(por)out.push({head:por.name+' is in MVP form',blurb:por.name+(por.team_id!=null?' of '+tName(por.team_id):'')+' tops the league with a '+avgRating(por.rating,por.matches)+' average rating across '+por.matches+' games.',tag:'Player',link:'#/player/'+por.id,score:80,desk:'Player Spotlight'});
  const m=[...e].sort((a,b)=>b.mvp-a.mvp)[0];if(m&&m.mvp>0&&(!por||m.id!==por.id))out.push({head:m.name+' is collecting hardware',blurb:m.name+' has claimed '+m.mvp+' MVP'+(m.mvp>1?'s':'')+' so far this season.',tag:'Player',link:'#/player/'+m.id,score:62,desk:'Player Spotlight'});
  const k=[...e].filter(a=>a.deaths>0).sort((a,b)=>((b.kills+b.assists)/b.deaths)-((a.kills+a.assists)/a.deaths))[0];if(k&&(!por||k.id!==por.id)&&(!m||k.id!==m.id))out.push({head:k.name+' is nearly unkillable',blurb:k.name+' sports a league-best '+((k.kills+k.assists)/k.deaths).toFixed(1)+' KDA.',tag:'Player',link:'#/player/'+k.id,score:50,desk:'Player Spotlight'});
  return out.slice(0,limit);}
function deskTransfers(limit){const out=[];if(!D.transfers)return out;
  for(const t of D.transfers){if(t.from==null)continue; // debut/initial signings are career history, not transfer news
    const a=athById[t.athlete_id],who=a?a.name:('Player #'+t.athlete_id),to=tName(t.to),from=tName(t.from);
    const fee=t.fee>0?(' for '+money(t.fee)):' on a free transfer';
    const head=who+': '+from+' → '+to;
    const blurb=who+' moves from '+from+' to '+to+fee+(t.salary>0?(' · '+money(t.salary)+'/wk'):'')+'.';
    out.push({head,blurb,tag:'Transfer',link:'#/player/'+t.athlete_id,score:(t.fee||0)+1,desk:'Transfers'});
    if(out.length>=limit)break;}
  return out;}
// Game-native news: resolve a title key against window.NEWS_TEXT + substitute {binds}.
function newsText(key){let o=window.NEWS_TEXT;if(!o)return null;for(const k of String(key).split('.')){if(o==null)return null;o=o[k];}return typeof o==='string'?o:null;}
// Game i18n carries inline markup (<#rrggbbaa>…<> colour spans etc.) — strip it so it
// doesn't render as literal text once esc()'d.
function stripTags(s){return String(s==null?'':s).replace(/<[^>]*>/g,'');}
// Substitute {Param} binds. The game's EN templates often drop the space around a
// placeholder (a Korean-localization artifact → "to{Condition}", "reached{Hours}hours"),
// so re-insert a space at any alnum↔alnum seam created by the substitution.
function subst(tpl,binds){let t=String(tpl==null?'':tpl);
  (binds||[]).forEach(p=>{const k=String(p[0]).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),v=String(p[1]);
    t=t.replace(new RegExp('\\{'+k+'\\}','g'),(m,off,str)=>{const b=str[off-1],a=str[off+m.length];
      return (b&&/\w/.test(b)&&/^\w/.test(v)?' ':'')+v+(a&&/\w/.test(a)&&/\w$/.test(v)?' ':'');});});
  return t;}
function resolveNews(it){const t=newsText(it.title);return t==null?null:stripTags(subst(t,it.tb));}
function resolveBody(it){if(!it.body)return null;const t=newsText(it.body);return t==null?null:stripTags(subst(t,it.body_tb));}

// ===== Reporter synthesis: write the article body from OUR data, by scope =====
function pick(arr,i){return arr[((i%arr.length)+arr.length)%arr.length];}
function bindVal(it,k){const a=(it.body_tb||[]).concat(it.tb||[]);for(const p of a)if(p[0]===k)return p[1];return null;}
function newsScope(it){const s=String(it.title).split('.');return (s[0]==='article'||s[0]==='alert')?s[1]:s[0];}
function teamBind(it,k){const v=bindVal(it,k);return v?teamByName[String(v).toLowerCase()]:null;}
function athBind(it){const id=bindVal(it,'AthleteId');if(id!=null&&athById[+id])return athById[+id];const nm=bindVal(it,'Athlete');return nm?athByName[String(nm).toLowerCase()]:null;}
function rankPhrase(r){if(!r)return '';return (['','1st','2nd','3rd'][r.rank]||(r.rank+'th'))+' of '+r.n;}
function leagueName(t){const l=t&&leagueById[t.league_id];return l?lgName(l):null;}
function teamStar(tid){return D.athletes.filter(a=>a.team_id==tid&&a.matches>0).sort((x,y)=>(y.rating/(y.matches*10))-(x.rating/(x.matches*10)))[0]||null;}
function recStr(r){return r?(r.s.win+'–'+r.s.lose):'';}
function formDots(tid,n){return teamForm(tid,n||5).map(w=>'<span class="'+(w?'win':'loss')+'">'+(w?'W':'L')+'</span>').join('');}
function h2hGames(a,b){return D.matches.filter(m=>(m.blue_team_id==a&&m.red_team_id==b)||(m.blue_team_id==b&&m.red_team_id==a));}
// Name-ONLY links for article prose (logos/avatars belong in tables/cards, not mid-sentence).
const tLinkT=id=>'<a href="#/team/'+id+'">'+esc(tName(id))+'</a>';
const aLinkT=id=>athById[id]?'<a href="#/player/'+id+'" data-player="'+id+'">'+esc(athById[id].name)+'</a>':('#'+id);
const cLinkT=name=>'<a href="#/champion/'+encodeURIComponent(name)+'">'+esc(champName(name))+'</a>';
function statLabel(field){if(typeof ATTR_DEFS!=='undefined')for(const d of ATTR_DEFS)if(d[1]===field)return d[0];return cap(String(field).replace(/_/g,' '));}
function statChangeLine(sc){const parts=[];String(sc||'').split(';').forEach(e=>{const x=e.split('|');if(x.length>=3){const f=x[0].split('?').pop().split('.').pop();parts.push(statLabel(f)+' '+x[1]+'→'+x[2]);}});return parts;}
function synthTraining(it,i){const a=athBind(it),T=teamBind(it,'Team'),changes=statChangeLine(bindVal(it,'StatChanges'));
  if(!a&&!changes.length)return null;
  const n=+bindVal(it,'Amount')||changes.length;
  let p='<p>'+(a?aLinkT(a.id):'A player')+(T?' of '+tLinkT(T.id):'')+'’s latest training cycle '+pick(['flagged','recorded','came back with'],i)+' '+n+' stat decline'+(n===1?'':'s')+'.</p>';
  if(changes.length)p+='<p class="bynum">'+changes.join('  ·  ')+'</p>';
  p+='<p>One wobble is rarely a problem, but repeated drops on the same player can derail a development plan — worth checking whether it’s a condition dip or a training-direction mismatch.</p>';
  return p;}
function synthDecision(it,i){const a=athBind(it);if(!a)return null;
  let p='<p>A management call looms over '+aLinkT(a.id)+(a.team_id!=null?' of '+tLinkT(a.team_id):'')+'.';
  if(a.matches>0)p+=' '+esc(a.name)+' is carrying a <b>'+avgRating(a.rating,a.matches)+'</b> rating across '+a.matches+' game'+(a.matches>1?'s':'')+' this season, so how the staff handle it could swing the run-in.';
  else p+=' How the staff handle it could shape the player’s season.';
  return p+'</p>';}
function synthMatch(it,i){const A=teamBind(it,'MyTeam'),B=teamBind(it,'EnemyTeam');if(!A||!B)return null;
  // Narrate from A (MyTeam = the article's subject, matching the game headline) but pick
  // the win/loss language from the REAL scoreline so the body can't contradict the result.
  const as=+bindVal(it,'MyScore')||0,bs=+bindVal(it,'EnemyScore')||0,aWon=as>=bs,win=aWon?A:B,close=Math.abs(as-bs)<=1;
  const WV=close?['edged','outlasted','held off','squeezed past']:['dispatched','rolled past','took apart','overpowered'];
  const LV=close?['fell just short against','were edged by','dropped a tight one to','came up short against']:['were dispatched by','fell to','were overpowered by','got rolled by'];
  let p='<p>'+tLinkT(A.id)+' '+pick(aWon?WV:LV,i)+' '+tLinkT(B.id)+' <b>'+as+'–'+bs+'</b>'+(close?' in a series that went the distance':'')+'.';
  const wr=teamRank(win.id);if(wr)p+=' '+esc(win.name)+' '+pick(['move to','sit','now hold'],i)+' '+rankPhrase(wr)+(leagueName(win)?' in '+esc(leagueName(win)):'')+'.';
  p+='</p>';
  const games=h2hGames(A.id,B.id);let mvp=null,best=-1,mg=null;
  games.forEach(m=>{const wid=m.blue_win?m.blue_team_id:m.red_team_id;if(wid!=win.id)return;m.picks.filter(x=>x.blue===m.blue_win).forEach(x=>{const sc=(x.kills||0)*2+(x.assists||0)-(x.deaths||0)*1.5+(x.deal||0)/2000;if(sc>best){best=sc;mvp=x;mg=m;}});});
  if(mvp){const a=athById[mvp.athlete_id];p+='<p>'+(a?aLinkT(a.id):'A standout')+' of '+tLinkT(win.id)+' set the tempo on '+cLinkT(mvp.champion)+', posting <b>'+(mvp.kills||0)+'/'+(mvp.deaths||0)+'/'+(mvp.assists||0)+'</b>'+(mvp.deal?' for '+(mvp.deal).toLocaleString()+' damage':'')+(mg?' — <a href="#/match/'+mg.id+'">view game</a>':'')+'.</p>';}
  return p;}
function synthPreMatch(it,i){const A=teamBind(it,'Team')||teamByName[String(bindVal(it,'TeamName')||'').toLowerCase()],B=teamBind(it,'EnemyTeam');if(!A&&!B)return null;
  if(A&&B){const ar=teamRank(A.id),br=teamRank(B.id),sa=teamStar(A.id),sb=teamStar(B.id);
    let p='<p>'+tLinkT(A.id)+(ar?' ('+rankPhrase(ar)+', '+recStr(ar)+')':'')+' '+pick(['square off with','run into','take on','meet'],i)+' '+tLinkT(B.id)+(br?' ('+rankPhrase(br)+', '+recStr(br)+')':'')+'.';
    if(sa||sb)p+=' Eyes on '+(sa?aLinkT(sa.id)+' ('+avgRating(sa.rating,sa.matches)+')':'')+(sa&&sb?' and ':'')+(sb?aLinkT(sb.id)+' ('+avgRating(sb.rating,sb.matches)+')':'')+'.';
    p+='</p>';
    const h=h2hGames(A.id,B.id);if(h.length){let aw=0;h.forEach(m=>{if((m.blue_win?m.blue_team_id:m.red_team_id)==A.id)aw++;});const bw=h.length-aw,verb=aw>bw?'lead':aw<bw?'trail':'are level in';p+='<p>They have met '+h.length+' time'+(h.length>1?'s':'')+' recently; '+esc(A.name)+' '+verb+' the head-to-head '+aw+'–'+bw+'.</p>';}
    p+='<p class="bynum">Form — '+esc(A.name)+': '+(formDots(A.id)||'—')+' &nbsp;·&nbsp; '+esc(B.name)+': '+(formDots(B.id)||'—')+'</p>';return p;}
  const T=A||B,r=teamRank(T.id),st=teamStar(T.id);
  let p='<p>'+tLinkT(T.id)+' '+pick(['head into the fixture','prep for the next test','look to bank points'],i)+(r?' '+rankPhrase(r)+' on a '+recStr(r)+' record':'')+'.';
  if(st)p+=' '+aLinkT(st.id)+' leads the side ('+avgRating(st.rating,st.matches)+' rating'+(st.mvp?', '+st.mvp+' MVP'+(st.mvp>1?'s':''):'')+').';
  return p+'</p><p class="bynum">Form: '+(formDots(T.id,6)||'—')+'</p>';}
function synthPlayer(it,i){const a=athBind(it);if(!a)return null;
  // Topic-aware: LEAD with the game's actual story (broadcast hours, condition, training…),
  // spacing-fixed + linkified, THEN ground it with the player's competitive form when they've played.
  const g=resolveBody(it);
  const lead=g?linkifyNews(g,it).split(/\n+/).map(s=>s.trim()).filter(Boolean).map(s=>'<p>'+s+'</p>').join(''):'';
  let data='';
  if(a.matches>0){const kda=a.deaths?((a.kills+a.assists)/a.deaths).toFixed(2):'—';
    const intro=lead?(pick(['On the rift, ','In competition, ','Between the lines, '],i)+esc(a.name)):(aLinkT(a.id)+(a.team_id!=null?' of '+tLinkT(a.team_id):''));
    data='<p>'+intro+' is averaging a <b>'+avgRating(a.rating,a.matches)+'</b> rating on a '+kda+' KDA across '+a.matches+' game'+(a.matches>1?'s':'')+(a.mvp?', with '+a.mvp+' MVP'+(a.mvp>1?'s':''):'')+'.</p>';
    if(a.recent_champions&&a.recent_champions.length)data+='<p>Signature picks: '+a.recent_champions.slice(0,4).map(c=>cLink(c)).join(', ')+'.</p>';}
  return (lead+data)||null;}
function synthTransfer(it,i){const buy=teamBind(it,'BuyTeam'),sell=teamBind(it,'SellTeam'),ath=athBind(it);
  if(buy&&ath){let p='<p>'+aLinkT(ath.id)+' '+pick(['completes a switch','is on the move','has agreed terms','changes colours'],i)+(sell?' from '+tLinkT(sell.id):'')+' to '+tLinkT(buy.id)+(bindVal(it,'Money')?' for '+esc(bindVal(it,'Money')):'')+'.';
    if(ath.matches>0)p+=' '+esc(ath.name)+' arrives with a <b>'+avgRating(ath.rating,ath.matches)+'</b> rating from '+ath.matches+' game'+(ath.matches>1?'s':'')+' last on the books.';
    return p+'</p>';}
  const T=teamBind(it,'Team'),pos=bindVal(it,'Position');
  if(T&&pos){const PI={top:0,jungle:1,jng:1,mid:2,bottom:3,bot:3,support:4,sup:4}[String(pos).toLowerCase()];
    const st=(PI!=null&&T.roster&&T.roster[PI]!=null)?athById[T.roster[PI]]:null;
    let p='<p>'+tLinkT(T.id)+' '+pick(['are reportedly thin','have a question mark','look light'],i)+' at <b>'+esc(pos)+'</b>.';
    if(st)p+=' '+aLinkT(st.id)+' holds the spot'+(st.matches>0?' ('+avgRating(st.rating,st.matches)+' rating)':'')+', but the depth behind looks shallow.';
    if(T.finance)p+=' A transfer budget of '+money(T.finance.transfer_budget)+' gives the front office room to act.';
    return p+'</p>';}
  // recruit_to_other_team: a player drawing interest from another club (Athlete + the suitor Team).
  if(ath&&T){let p='<p>'+aLinkT(ath.id)+(ath.team_id!=null?' of '+tLinkT(ath.team_id):'')+' '+pick(['is drawing interest from','has been linked with','is on the radar at'],i)+' '+tLinkT(T.id)+'.';
    if(ath.matches>0)p+=' '+esc(ath.name)+' brings a <b>'+avgRating(ath.rating,ath.matches)+'</b> rating from '+ath.matches+' game'+(ath.matches>1?'s':'')+' this season.';
    return p+'</p>';}
  return null;}
function synthSeason(it,i){const T=teamBind(it,'Team')||teamByName[String(bindVal(it,'TeamName')||'').toLowerCase()];if(!T)return null;
  const r=teamRank(T.id),l=leagueById[T.league_id];
  let p='<p>'+tLinkT(T.id)+' '+pick(['open a fresh chapter','set their sights ahead','look to climb'],i)+(l?' in '+esc(lgName(l)):'')+'.';
  if(r)p+=' They sit '+rankPhrase(r)+' on a '+recStr(r)+' record.';
  const prize=l&&l.prize_pool?l.prize_pool.reduce((x,y)=>x+y,0):0,pm=money(prize);if(prize>0&&pm!=='$0')p+=' The league carries a '+pm+' prize pool.';
  p+='</p>';
  if(T.rank_hist&&T.rank_hist.length>=2){const cur=T.rank_hist[T.rank_hist.length-1],d=T.rank_hist[0]-cur;
    p+='<p>'+(d>0?'Trending up — ':d<0?'Slipping — ':'Holding steady — ')+esc(T.name)+(d?(' have moved '+Math.abs(d)+' place'+(Math.abs(d)>1?'s':'')+(d>0?' up':' down')+' since the trend window opened.'):' have held their position.')+'</p>';}
  return p;}
// Fallback: the game's own (spacing-fixed) body, with bind-named entities linked.
function linkifyNews(text,it){let h=esc(text);const subs=[];
  ['Team','EnemyTeam','SellTeam','BuyTeam','MyTeam','TeamName'].forEach(k=>{const v=bindVal(it,k);if(v&&teamByName[String(v).toLowerCase()])subs.push([v,tLinkT(teamByName[String(v).toLowerCase()].id)]);});
  const a=athBind(it);if(a)subs.push([a.name,aLinkT(a.id)]);
  subs.sort((x,y)=>String(y[0]).length-String(x[0]).length).forEach(([nm,link])=>{h=h.split(esc(nm)).join(link);});
  return h;}
function articleBody(it,i){i=i||0;const sc=newsScope(it);let h=null;
  if(sc==='match_report'||sc==='match')h=synthMatch(it,i);
  else if(sc==='pre_match'||sc==='pre_match_analysis')h=synthPreMatch(it,i);
  else if(sc==='player')h=synthPlayer(it,i);
  else if(sc==='transfer'||sc==='transfer_gossip'||sc==='recruit_to_other_team'||sc==='end_recruit')h=synthTransfer(it,i);
  else if(sc==='season'||sc==='international_seed')h=synthSeason(it,i);
  else if(sc==='training'||sc==='training_report')h=synthTraining(it,i);
  else if(sc==='decision')h=synthDecision(it,i);
  if(h)return h;
  const g=resolveBody(it);
  if(g)return linkifyNews(g,it).split(/\n+/).map(s=>s.trim()).filter(Boolean).map(s=>'<p>'+s+'</p>').join('');
  return null;}
function articleExcerpt(it,i){
  // No synthesized/game body → no excerpt (the office card then shows just the headline,
  // instead of echoing it). Otherwise drop crest/badge/avatar spans (their initials are
  // TEXT → would leave "DGDead Game") before flattening to plain text.
  const b=articleBody(it,i);if(!b)return '';
  return clip(stripTags(String(b).replace(/<span class="(?:crest|badge|avatar)[^"]*"[^>]*>[^<]*<\/span>/g,'')),190);}
// Synthesize a plain-text headline from our data (accurate where the game's wording isn't,
// and available even on the in-game page where NEWS_TEXT — the i18n table — is absent).
function synthHead(it,i){const sc=newsScope(it);
  if(sc==='match_report'||sc==='match'){const A=teamBind(it,'MyTeam'),B=teamBind(it,'EnemyTeam');if(!A||!B)return null;
    const as=+bindVal(it,'MyScore')||0,bs=+bindVal(it,'EnemyScore')||0,aWon=as>=bs,W=aWon?A:B,L=aWon?B:A,ws=Math.max(as,bs),ls=Math.min(as,bs);
    const wr=teamRank(W.id),lr=teamRank(L.id),upset=!!(wr&&lr&&wr.rank>=lr.rank+3),close=(ws-ls)<=1;
    const V=aWon?(upset?['stun','shock','upset']:close?['edge','outlast','hold off']:['take down','dispatch','roll past'])
               :(close?['fall just short to','are edged by','drop a close one to']:['fall to','are routed by','go down to']);
    return A.name+' '+pick(V,i)+' '+B.name+' '+as+'–'+bs;}
  if(sc==='pre_match'||sc==='pre_match_analysis'){const A=teamBind(it,'Team')||teamByName[String(bindVal(it,'TeamName')||'').toLowerCase()],B=teamBind(it,'EnemyTeam');
    if(A&&B)return A.name+' '+pick(['meet','face','clash with','take on'],i)+' '+B.name;
    if(A)return A.name+' '+pick(['look ahead to the next test','eye a bounce-back','prep for match day'],i);return null;}
  if(sc==='player'){const a=athBind(it);if(!a||a.matches<1)return null;
    return a.name+' '+pick(['catches fire','is in form','keeps rolling'],i)+(a.team_id!=null&&teamById[a.team_id]?' for '+teamById[a.team_id].name:'');}
  if(sc==='transfer'||sc==='transfer_gossip'||sc==='recruit_to_other_team'){const buy=teamBind(it,'BuyTeam'),ath=athBind(it);
    if(buy&&ath)return ath.name+' '+pick(['joins','signs for','heads to'],i)+' '+buy.name;
    const T=teamBind(it,'Team'),pos=bindVal(it,'Position');if(T&&pos)return T.name+' eye '+pos+' depth';return null;}
  if(sc==='season'||sc==='international_seed'){const T=teamBind(it,'Team')||teamByName[String(bindVal(it,'TeamName')||'').toLowerCase()];
    if(T)return T.name+' '+pick(['open their campaign','set their sights on the season','eye a climb'],i);return null;}
  return null;}
// Pick the headline: for match scopes the game's own wording can misstate the winner →
// always prefer our synthesized line; otherwise keep the game's (topical, colourful)
// headline when present, and fall back to synthesis (covers the NEWS_TEXT-less in-game page).
function headline(it,i){const sc=newsScope(it);
  if(sc==='match_report'||sc==='match'){const s=synthHead(it,i);if(s)return s;}
  return resolveNews(it)||synthHead(it,i);}
function clip(s,n){s=String(s||'');return s.length>n?s.slice(0,n-1).replace(/\s+\S*$/,'')+'…':s;}
const OFFICE_TAGS={transfer:'Transfer',transfer_gossip:'Transfer',recruit_to_other_team:'Transfer',match:'Match',match_report:'Match',pre_match:'Preview',pre_match_analysis:'Preview',meta:'Meta',player:'Player',fan:'Fans',finance:'Finance',scout:'Scouting',training:'Training',training_report:'Training',facility:'Facility',league:'League',international_seed:'League',season:'Season',merch:'Merch',author:'Op-Ed',decision:'Roster',start_team:'League',start_recruit:'Recruiting',end_recruit:'Recruiting',solo_rank_report:'Solo Rank',alert:'Alert'};
function deskOffice(limit){if(!D.news||!D.news.length)return [];const out=[];
  for(let idx=0;idx<D.news.length;idx++){const it=D.news[idx],head=headline(it,idx);if(!head)continue;
    out.push({head,body:articleExcerpt(it,idx),by:it.by,date:it.date,tag:OFFICE_TAGS[newsScope(it)]||'League',idx});
    if(out.length>=limit)break;}
  return out;}
function vNews(){
  const R=deskResults(4),S=deskStandings(4),M=deskMeta(3),P=deskPlayers(3),T=deskTransfers(4),all=[...R,...S,...M,...P,...T];
  let lead=null;all.forEach(s=>{if(!lead||s.score>lead.score)lead=s;});
  let h=heroHeader('','Newsroom','The League Wire','Reports from across the leagues · '+(D.today||('#'+(D.updated||0))),[]);
  if(!all.length)h+='<p class="sub">No stories yet — play out some matches and the desks will fill in.</p>';
  if(lead)h+='<a class="lead-story" href="'+lead.link+'"><span class="ntag '+(lead.cls||'')+'">'+lead.tag+'</span><div class="lead-h">'+esc(lead.head)+'</div><p>'+esc(lead.blurb)+'</p><span class="byline">— The '+lead.desk+' Desk</span></a>';
  const card=s=>'<a class="ncard" href="'+s.link+'"><span class="ntag '+(s.cls||'')+'">'+s.tag+'</span><div class="nhead">'+esc(s.head)+'</div><div class="nblurb">'+esc(s.blurb)+'</div></a>';
  const desk=(title,route,list)=>{const ls=list.filter(s=>s!==lead).slice(0,3);if(!ls.length)return '';return '<section class="ndesk"><div class="ndesk-h"><h2>'+title+'</h2><a class="more" href="'+route+'">more →</a></div>'+ls.map(card).join('')+'</section>';};
  h+='<div class="nroom">'+desk('Results','#/matches',R)+desk('Standings','#/standings',S)+desk('Transfers','#/transfers',T)+desk('Meta Watch','#/champions',M)+desk('Player Spotlight','#/players',P)+'</div>';
  const office=deskOffice(8);
  if(office.length){const ocard=s=>'<a class="ncard" href="#/article/'+s.idx+'"><span class="ntag">'+esc(s.tag)+'</span><div class="nhead">'+esc(s.head)+'</div>'+(s.body?'<div class="nblurb">'+esc(clip(s.body,200))+'</div>':'')+'<span class="byline">— '+esc(lgLabel(s.by))+(s.date?' · '+esc(s.date):'')+'</span></a>';
    h+='<section class="ndesk office"><div class="ndesk-h"><h2>From the League Office <small>straight off the game wire</small></h2></div><div class="owrap">'+office.map(ocard).join('')+'</div></section>';}
  mount(h);
}
function vArticle(i){const it=D.news&&D.news[+i];if(!it)return mount('<h1>Article not found</h1><p class="sub"><a href="#/news">← Back to the Newsroom</a></p>');
  const head=headline(it,+i)||'(untitled)',body=articleBody(it,+i);
  let h='<p class="sub"><a href="#/news">← Newsroom</a></p>';
  h+='<span class="ntag">'+esc(OFFICE_TAGS[newsScope(it)]||'League')+'</span><h1>'+esc(head)+'</h1>';
  h+='<p class="byline">— '+esc(lgLabel(it.by))+(it.date?' · '+esc(it.date):'')+'</p>';
  h+=body?('<div class="article-body">'+body+'</div>'):'<p class="sub">No further detail on the wire.</p>';
  if(it.team!=null&&teamById[it.team])h+='<p>Related: '+tLink(it.team)+'</p>';
  mount(h);
}
function vTransfers(){const ts=(D.transfers||[]).filter(t=>t.from!=null); // moves only; debut signings live on player profiles
  let h='<h1>Transfers</h1><p class="sub">'+ts.length+' recent move'+(ts.length===1?'':'s')+' across the leagues</p>';
  if(!ts.length)return mount(h+'<p class="sub">No transfers yet — initial squads are set; moves accrue once the transfer window opens.</p>');
  h+='<table class="s"><thead><tr><th>Date</th><th>Player</th><th>From</th><th>To</th><th data-num>Fee</th><th data-num>Salary</th></tr></thead><tbody>';
  ts.forEach(t=>{h+='<tr><td class="sub">'+esc(t.date||'')+'</td><td>'+aLink(t.athlete_id)+'</td><td>'+(t.from!=null?tLink(t.from):'<span class="sub">debut</span>')+'</td><td>'+tLink(t.to)+'</td><td class="num" data-s="'+(t.fee||0)+'">'+(t.fee>0?money(t.fee):'—')+'</td><td class="num" data-s="'+(t.salary||0)+'">'+(t.salary>0?money(t.salary)+'/wk':'—')+'</td></tr>';});
  mount(h+'</tbody></table>');
}
function vSearch(q){q=String(q||'').toLowerCase();
  const tm=D.teams.filter(t=>t.name.toLowerCase().includes(q)).slice(0,40);
  const pl=D.athletes.filter(a=>a.name.toLowerCase().includes(q)).slice(0,60);
  const ch=D.champions.filter(c=>champName(c.name).toLowerCase().includes(q)).slice(0,40);
  let h='<h1>Search: '+esc(q)+'</h1><h2>Teams</h2><div class="chips">'+(tm.map(t=>'<span>'+tLink(t.id)+'</span>').join('')||'<span class="sub">none</span>')+'</div>';
  h+='<h2>Players</h2><div class="chips">'+(pl.map(a=>'<span>'+aLink(a.id)+'</span>').join('')||'<span class="sub">none</span>')+'</div>';
  h+='<h2>Champions</h2><div class="chips">'+(ch.map(c=>'<span>'+cLink(c.name)+'</span>').join('')||'<span class="sub">none</span>')+'</div>';mount(h);}
function setActiveNav(){const seg=location.hash.replace(/^#\/?/,'').split('/')[0]||'';
  const m={'':'#/',standings:'#/standings',news:'#/news',article:'#/news',transfers:'#/news',teams:'#/teams',team:'#/teams',players:'#/players',player:'#/players','free-agents':'#/players',champions:'#/champions','champ-stats':'#/champions',champion:'#/champions',items:'#/items',item:'#/items',matches:'#/matches',match:'#/matches',h2h:'#/teams',leagues:'#/leagues',league:'#/leagues'};
  const want=m[seg]||'#/';document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')===want));}
function router(){setActiveNav();const p=location.hash.replace(/^#\/?/,'').split('/').map(decodeURIComponent);
  switch(p[0]){case '':return vHome();case 'standings':return vStandings();case 'news':return vNews();case 'teams':return vTeams();case 'team':return vTeam(+p[1]);
    case 'players':return vPlayers();case 'player':return vPlayer(+p[1]);case 'free-agents':return vFreeAgents();case 'champions':return vChampions();
    case 'champ-stats':return vChampStats();case 'items':return vItems();case 'item':return vItem(p.slice(1).join('/'));case 'h2h':return vH2H(p[1],p[2]);
    case 'champion':return vChampion(p.slice(1).join('/'));case 'matches':return vMatches();case 'match':return vMatch(+p[1]);
    case 'leagues':return vLeagues();case 'league':return vLeague(+p[1]);
    case 'article':return vArticle(p[1]);case 'transfers':return vTransfers();
    case 'search':return vSearch(p.slice(1).join('/'));default:return vStandings();}}
const curHash=()=>(location.hash&&location.hash!=='#')?location.hash:'#/';
addEventListener('hashchange',()=>{sessionStorage.setItem('hub_route',curHash());go();scrollTo(0,0);});
addEventListener('beforeunload',()=>{sessionStorage.setItem('hub_route',curHash());sessionStorage.setItem('hub_sy',scrollY);});
function setUpd(){const u=document.querySelector('#nav .upd');if(u)u.textContent='#'+(D.updated||0);}
// ===== "The Wire": a persistent right rail of live, glanceable widgets (fills the
// dead right-third on wide screens). Built once into a .shell wrapper around #app; it
// PERSISTS across routes (re-rendered only on data update), so it never flickers. =====
function ensureLayout(){const app=document.getElementById('app');if(!app||(app.parentNode&&app.parentNode.classList&&app.parentNode.classList.contains('shell')))return;
  const shell=document.createElement('div');shell.className='shell';
  app.parentNode.insertBefore(shell,app);shell.appendChild(app);
  const rail=document.createElement('aside');rail.id='rail';shell.appendChild(rail);}
const railWireItem=s=>'<a class="wire-i" href="'+s.link+'"><span class="ntag '+(s.cls||'')+'">'+esc(s.tag)+'</span><span class="wire-t">'+esc(s.head)+'</span></a>';
const railCard=(title,more,route,inner)=>inner?('<section class="rc"><div class="rc-h">'+title+(route?'<a class="rc-more" href="'+route+'">'+more+'</a>':'')+'</div>'+inner+'</section>'):'';
const rankRow=(href,art,name,val)=>'<a class="rk-i" href="'+href+'">'+art+'<span class="rk-nm">'+esc(name)+'</span>'+(val!=null&&val!==''?'<span class="rk-p">'+val+'</span>':'')+'</a>';
// CONTEXT-AWARE: the rail tailors itself to the current route (team/player/league get a
// bespoke sidebar), falling back to the global "wire" everywhere else.
function renderRail(){const rail=document.getElementById('rail');if(!rail||typeof D==='undefined'||!D.teams)return;
  const p=location.hash.replace(/^#\/?/,'').split('/').map(decodeURIComponent);let h='';
  if(p[0]==='team'&&teamById[+p[1]])h=railTeam(teamById[+p[1]]);
  else if(p[0]==='player'&&athById[+p[1]])h=railPlayer(athById[+p[1]]);
  else if(p[0]==='league'&&leagueById[+p[1]])h=railLeague(leagueById[+p[1]]);
  rail.innerHTML=h||railGlobal();}
function railGlobal(){let h='';
  const wire=[].concat(deskResults(3),deskTransfers(2),deskStandings(2)).filter(Boolean).slice(0,5);
  h+='<section class="rc"><div class="rc-h"><span class="livedot"></span>The Wire<a class="rc-more" href="#/news">newsroom →</a></div>'
    +(wire.length?wire.map(railWireItem).join(''):'<p class="sub" style="padding:11px 13px">Stories appear as matches play out.</p>')+'</section>';
  const leaders=[];D.competitions.forEach(c=>{if(c.standings&&c.standings[0])leaders.push(c.standings[0]);});leaders.sort((a,b)=>b.points-a.points);
  h+=railCard('Top of the Table','leagues →','#/leagues',leaders.slice(0,5).map((s,i)=>'<a class="rk-i" href="#/team/'+s.team_id+'"><span class="rk-n">'+(i+1)+'</span>'+teamLogo(s.team_id,22)+'<span class="rk-nm">'+esc(tName(s.team_id))+'</span><span class="rk-p">'+s.points+'</span></a>').join(''));
  h+=railCard('Meta Pulse','tier list →','#/champions',deskMeta(2).map(railWireItem).join(''));
  const form=D.athletes.filter(a=>a.matches>=3).sort((a,b)=>(b.rating/(b.matches*10))-(a.rating/(a.matches*10))).slice(0,4);
  h+=railCard('In Form','players →','#/players',form.map(a=>rankRow('#/player/'+a.id,avatar(a.id,22),a.name,avgRating(a.rating,a.matches))).join(''));
  return h;}
function nextMatch(t){let best=null,bc=null;(compsByLeague[t.league_id]||[]).forEach(c=>{(c.sched||[]).forEach(m=>{if(m.done)return;
  const r1=String(m.t1).match(/^Normal\((\d+)\)/),r2=String(m.t2).match(/^Normal\((\d+)\)/);let opp=null;
  if(r1&&+r1[1]===t.id)opp=m.t2;else if(r2&&+r2[1]===t.id)opp=m.t1;else return;
  if(!best||String(m.date)<String(best.date)){best=m;best.opp=opp;bc=c;}});});return best?{m:best,opp:best.opp,comp:bc}:null;}
function railTeam(t){let h='';
  let rk=null,st=null;for(const c of (compsByLeague[t.league_id]||[])){const i=c.standings.findIndex(s=>s.team_id==t.id);if(i>=0){rk=i+1;st=c.standings[i];break;}}
  if(st)h+='<section class="rc"><div class="rc-h">'+esc(tName(t.id))+'<a class="rc-more" href="#/league/'+t.league_id+'">'+esc(lgName(t.league_id))+' →</a></div>'
    +'<div class="rail-kpi"><div><span class="l">Rank</span><span class="v'+(rk===1?' gold':'')+'">#'+rk+'</span></div><div><span class="l">Record</span><span class="v">'+st.win+'–'+st.lose+'</span></div><div><span class="l">Points</span><span class="v">'+st.points+'</span></div></div></section>';
  const nx=nextMatch(t);if(nx)h+=railCard('Next Up','schedule →','#/league/'+t.league_id,'<div class="rail-next"><span class="sub">'+esc(nx.m.date)+'</span><div>vs '+decodeRef(nx.opp,nx.comp)+'</div></div>');
  const log=[];D.matches.forEach(m=>{if(log.length>=4)return;if(m.blue_team_id==t.id||m.red_team_id==t.id){const won=(m.blue_team_id==t.id)===m.blue_win;const opp=m.blue_team_id==t.id?m.red_team_id:m.blue_team_id;log.push({m,won,opp});}});
  if(log.length)h+=railCard('Recent Form','','',log.map(x=>'<a class="rk-i" href="#/match/'+x.m.id+'"><span class="rk-n '+(x.won?'win':'loss')+'">'+(x.won?'W':'L')+'</span>'+teamLogo(x.opp,22)+'<span class="rk-nm">'+esc(tName(x.opp))+'</span></a>').join(''));
  const starterIds=(t.roster||[]).filter(x=>x!=null),sset=new Set(starterIds);
  const squad=[...starterIds,...(squadByTeam[t.id]||[]).filter(id=>!sset.has(id))]; // starters first, then bench (subs now resolve)
  if(squad.length)h+=railCard('Squad','team page →','#/team/'+t.id,squad.slice(0,9).map(aid=>{const a=athById[aid];return rankRow('#/player/'+aid,avatar(aid,22),a?a.name:'#'+aid,a&&a.matches?avgRating(a.rating,a.matches):(sset.has(aid)?'':'<span class="sub">sub</span>'));}).join(''));
  const news=(D.news||[]).filter(n=>n.team==t.id).slice(0,3);
  if(news.length)h+=railCard('Club News','newsroom →','#/news',news.map(n=>{const idx=D.news.indexOf(n);return '<a class="wire-i" href="#/article/'+idx+'"><span class="ntag">'+esc(OFFICE_TAGS[newsScope(n)]||'News')+'</span><span class="wire-t">'+esc(headline(n,idx))+'</span></a>';}).join(''));
  return h||railGlobal();}
function railPlayer(a){let h='';
  const rated=D.athletes.filter(x=>x.matches>=3).sort((x,y)=>(y.rating/(y.matches*10))-(x.rating/(x.matches*10)));const rk=rated.findIndex(x=>x.id==a.id);
  const kda=a.deaths?((a.kills+a.assists)/a.deaths).toFixed(2):'—';
  h+='<section class="rc"><div class="rc-h">'+esc(a.name)+(a.team_id!=null?'<a class="rc-more" href="#/team/'+a.team_id+'">'+esc(tName(a.team_id))+' →</a>':'')+'</div>'
    +'<div class="rail-kpi"><div><span class="l">Rating</span><span class="v">'+(a.matches?avgRating(a.rating,a.matches):'—')+'</span></div><div><span class="l">KDA</span><span class="v">'+kda+'</span></div><div><span class="l">MVP</span><span class="v">'+a.mvp+'</span></div></div>'
    +(rk>=0?'<div class="rail-note">#'+(rk+1)+' of '+rated.length+' by rating</div>':'')+'</section>';
  if(a.team_id!=null&&teamById[a.team_id]){const mates=(teamById[a.team_id].roster||[]).filter(x=>x!=null&&x!=a.id);
    if(mates.length)h+=railCard('Teammates',esc(tName(a.team_id))+' →','#/team/'+a.team_id,mates.map(id=>{const m=athById[id];return rankRow('#/player/'+id,avatar(id,22),m?m.name:'#'+id,m&&m.matches?avgRating(m.rating,m.matches):'');}).join(''));}
  const log=[];D.matches.forEach(m=>{if(log.length>=5)return;const pk=m.picks.find(x=>x.athlete_id==a.id);if(pk){const won=pk.blue===m.blue_win;log.push({m,pk,won});}});
  if(log.length)h+=railCard('Recent Games','','',log.map(x=>'<a class="rk-i" href="#/match/'+x.m.id+'"><span class="rk-n '+(x.won?'win':'loss')+'">'+(x.won?'W':'L')+'</span>'+champIcon(x.pk.champion,22)+'<span class="rk-nm">'+esc(champName(x.pk.champion))+'</span></a>').join(''));
  return h||railGlobal();}
function railLeague(l){let h='';const comp=(compsByLeague[l.id]||[])[0];
  if(comp&&comp.standings.length)h+=railCard('Title Race',esc(lgName(l))+' →','#/league/'+l.id,comp.standings.slice(0,5).map((s,i)=>'<a class="rk-i" href="#/team/'+s.team_id+'"><span class="rk-n'+(i===0?' gold':'')+'">'+(i+1)+'</span>'+teamLogo(s.team_id,22)+'<span class="rk-nm">'+esc(tName(s.team_id))+'</span><span class="rk-p">'+s.points+'</span></a>').join(''));
  const inL=D.athletes.filter(a=>a.team_id!=null&&teamById[a.team_id]&&teamById[a.team_id].league_id==l.id&&a.matches>=2).sort((a,b)=>(b.rating/(b.matches*10))-(a.rating/(a.matches*10))).slice(0,4);
  if(inL.length)h+=railCard('Form Players','players →','#/players',inL.map(a=>rankRow('#/player/'+a.id,avatar(a.id,22),a.name,avgRating(a.rating,a.matches))).join(''));
  return h||railGlobal();}
// Swap in fresh data and re-render the current route IN PLACE (no page reload → no
// blink). Scroll is preserved; the nav (incl. the search box) is left intact, only the
// update counter ticks. Sort state on the current table resets, same as a reload would.
function applyData(d){if(!d)return;D=d;buildIndex();router();renderRail();setUpd();}
const HOSTED=/^https?:$/.test(location.protocol);
// Navigate: render the route WITH the entrance reveal (hosted site only) + refresh the
// context rail. Data-refresh (applyData) and sprite-load re-renders deliberately skip the reveal.
function go(){_reveal=HOSTED;router();_reveal=false;renderRail();}
// Hosted site only: poll league_data.json and apply it when the publish counter moves.
// The local file:// broadcast page can't fetch a sibling, so it keeps its <meta refresh>
// (the mod rewrites that whole file each tick); polling is skipped there.
function startPolling(){if(!/^https?:$/.test(location.protocol))return;
  setInterval(()=>{fetch('league_data.json',{cache:'no-store'}).then(r=>r.ok?r.json():null)
    .then(d=>{if(d&&d.updated!==D.updated)applyData(d);}).catch(()=>{});},20000);}
// A <meta refresh> reload can drop the URL fragment; restore the route before rendering.
const savedRoute=sessionStorage.getItem('hub_route');
if(savedRoute&&savedRoute!=='#/'&&(!location.hash||location.hash==='#'||location.hash==='#/')){history.replaceState(null,'',savedRoute);}
ensureLayout();buildIndex();nav();go();spInit();
const sy=sessionStorage.getItem('hub_sy');if(sy)scrollTo(0,+sy);
startPolling();
