
let D=window.LEAGUE_DATA||{leagues:[],competitions:[],teams:[],athletes:[],matches:[],champions:[],items:[]};
// Indices are rebuilt by buildIndex() so the hosted site can swap in fresh data
// (applyData) without a full-page reload. ATTR_MAX is derived from the data too.
let teamById={},athById={},leagueById={},champByName={},compsByLeague={},ATTR_MAX=1;
function buildIndex(){
  D.items=D.items||[];
  teamById={};athById={};leagueById={};champByName={};compsByLeague={};
  D.teams.forEach(t=>teamById[t.id]=t);D.athletes.forEach(a=>athById[a.id]=a);
  D.leagues.forEach(l=>leagueById[l.id]=l);D.champions.forEach(c=>champByName[c.name]=c);
  D.competitions.forEach(c=>{(compsByLeague[c.league_id]=compsByLeague[c.league_id]||[]).push(c);});
  ATTR_MAX=Math.max(1,...D.athletes.flatMap(a=>a.attr?ATTR_DEFS.map(d=>a.attr[d[1]]||0):[0]));
}
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const cap=w=>w?w[0].toUpperCase()+w.slice(1):'';
const champName=id=>String(id).split('_').map(cap).join(' ');
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
function spInit(){if(SP_IMG||!window.PLAYER_SHEET_URL||!window.PLAYER_CELLS)return;SP_IMG=new Image();SP_IMG.onload=function(){SP_READY=true;router();};SP_IMG.src=window.PLAYER_SHEET_URL;}
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
const aLink=(id,sz)=>athById[id]?'<a href="#/player/'+id+'">'+avatar(id,sz)+esc(athById[id].name)+'</a>':'#'+id;
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
const lLink=id=>leagueById[id]?'<a href="#/league/'+id+'">'+esc(leagueById[id].name)+'</a>':('League '+id);
// Inline-SVG sparkline. invert=true puts smaller values up top (for rank, where #1 is best).
function spark(vals,invert,W,H){W=W||150;H=H||32;const P=4,n=vals?vals.length:0;if(n<2)return '<span class="sub">—</span>';
  const min=Math.min(...vals),max=Math.max(...vals),rng=(max-min)||1;
  const X=i=>P+i/(n-1)*(W-2*P),Y=v=>{let t=(v-min)/rng;if(invert)t=1-t;return P+(1-t)*(H-2*P);};
  const pts=vals.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
  return '<svg class="spark" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" preserveAspectRatio="none"><polyline points="'+pts+'"/><circle cx="'+X(n-1).toFixed(1)+'" cy="'+Y(vals[n-1]).toFixed(1)+'" r="2.2"/></svg>';}
const itemName=i=>{const k=D.items[i];return k?champName(k):'#'+i;};
// item icon: CSS-crop the 18×18 atlas via window.ITEM_ICONS[i]=[x,y,w,h] px. Absent → ''.
function itemIcon(i,size){size=size||24;const r=window.ITEM_ICONS&&window.ITEM_ICONS[i];if(!r||!r[3])return '';
  const s=size/r[3];
  return '<span class="iico" style="width:'+(r[2]*s).toFixed(1)+'px;height:'+size+'px;background-image:url(\''+(window.ICON_BASE||'')+window.ITEM_SHEET_URL+'\');background-size:'+(window.ITEM_SW*s).toFixed(1)+'px '+(window.ITEM_SH*s).toFixed(1)+'px;background-position:'+(-r[0]*s).toFixed(1)+'px '+(-r[1]*s).toFixed(1)+'px"></span>';}
// Facility/stadium grade enum index -> letter (confirmed in-game: A=3, S=4).
const grade=i=>['D','C','B','A','S'][i]||('Lv '+i);
const money=v=>{v=+v||0;const s=v<0?'-':'';v=Math.abs(v);if(v>=1e9)return s+'$'+(v/1e9).toFixed(2)+'B';if(v>=1e6)return s+'$'+(v/1e6).toFixed(1)+'M';if(v>=1e3)return s+'$'+(v/1e3).toFixed(0)+'K';return s+'$'+v.toFixed(0);};
const POS=['Top','Jungle','Mid','Bot','Sup'];
const ATTR_DEFS=[['Monster Kills','last_hit'],['Skill Dodge','skill_avoid'],['Skill Hit','skill_hit'],['Control Speed','control_speed'],['Positioning','positioning'],['Judgment','judgement'],['Mental','mental'],['Focus','concentration'],['Calls','order'],['Roaming','roaming'],['Aggression','aggressive'],['Ego','ego']];
function makeSortable(t){[...t.tHead.rows[0].cells].forEach((th,i)=>{if('nosort' in th.dataset)return;th.style.cursor='pointer';
  th.onclick=()=>{const tb=t.tBodies[0];const rows=[...tb.rows];const dir=th._d=-(th._d||1);const num='num' in th.dataset;
    rows.sort((a,b)=>{let x=a.cells[i].dataset.s??a.cells[i].textContent,y=b.cells[i].dataset.s??b.cells[i].textContent;if(num){x=parseFloat(x)||0;y=parseFloat(y)||0;}else{x=(''+x).toLowerCase();y=(''+y).toLowerCase();}return x<y?dir:x>y?-dir:0;});
    rows.forEach(r=>tb.appendChild(r));};});}
function mount(html){const app=document.getElementById('app');app.innerHTML=html;app.querySelectorAll('table.s').forEach(makeSortable);}
function nav(){document.getElementById('nav').innerHTML='<span class="brand">🏆 League Hub</span>'+
  '<a href="#/">Standings</a><a href="#/news">News</a><a href="#/leagues">Leagues</a><a href="#/teams">Teams</a><a href="#/players">Players</a><a href="#/champions">Champions</a><a href="#/matches">Matches</a>'+
  '<input id="q" placeholder="Search teams, players, champions…"><span class="upd">#'+(D.updated||0)+'</span>';
  const q=document.getElementById('q');q.oninput=()=>{const v=q.value.trim();location.hash=v?('#/search/'+encodeURIComponent(v)):'#/';};}
function statCell(l,v,cls){return '<div><span class="l">'+esc(l)+'</span><span class="v'+(cls?' '+cls:'')+'">'+v+'</span></div>';}
function heroHeader(art,kick,title,sub,stats){return '<div class="hero">'+(art?'<div class="art">'+art+'</div>':'')+
  '<div class="ht"><div class="kick">'+esc(kick)+'</div><h1>'+title+'</h1>'+(sub?'<p class="sub">'+sub+'</p>':'')+
  (stats&&stats.length?'<div class="statline">'+stats.join('')+'</div>':'')+'</div></div>';}
function scrollToEl(id){const e=document.getElementById(id);if(e)e.scrollIntoView({behavior:'smooth',block:'start'});}
function vStandings(){
  let h=heroHeader('','League Hub','Standings','Custom-points standings · auto-updating live',
    [statCell('Leagues',D.leagues.length),statCell('Teams',D.teams.length),statCell('Update','#'+(D.updated||0))]);
  const pills=[];D.leagues.forEach(l=>{if((compsByLeague[l.id]||[]).length)pills.push('<a onclick="scrollToEl(\'lg-'+l.id+'\')">'+esc(l.name)+'</a>');});
  if(pills.length>1)h+='<div class="switch">'+pills.join('')+'</div>';
  D.leagues.forEach(l=>{(compsByLeague[l.id]||[]).forEach(c=>{
  h+='<h2 id="lg-'+l.id+'">'+lLink(l.id)+'</h2><table class="s"><thead><tr><th data-nosort>#</th><th>Team</th><th data-num>Pts</th><th data-num>W</th><th data-num>L</th><th data-num>Win%</th><th data-num>SW</th><th data-num>SL</th><th data-num>K</th><th data-num>Adj</th></tr></thead><tbody>';
  c.standings.forEach((s,i)=>{const adj=s.adj?('<span class="'+(s.adj>0?'pos">+':'neg">')+s.adj+'</span>'):'';
    h+='<tr'+(i===0?' class="lead"':'')+'><td>'+(i+1)+'</td><td>'+tLink(s.team_id)+'</td><td class="num"><b>'+s.points+'</b></td><td class="num">'+s.win+'</td><td class="num">'+s.lose+'</td><td class="num">'+pct(s.win,s.win+s.lose)+'</td><td class="num">'+s.set_win+'</td><td class="num">'+s.set_lose+'</td><td class="num">'+s.kill+'</td><td class="num">'+adj+'</td></tr>';});
  h+='</tbody></table>';});});mount(h);}
function vTeams(){let h='<h1>Teams</h1><table class="s"><thead><tr><th>Team</th><th>Manager</th><th>League</th><th data-num>Fans</th><th data-num>Balance</th></tr></thead><tbody>';
  D.teams.forEach(t=>{const l=leagueById[t.league_id];h+='<tr><td>'+tLink(t.id,40)+'</td><td>'+esc(t.manager)+'</td><td>'+lLink(t.league_id)+'</td><td class="num" data-s="'+t.fan_count+'">'+t.fan_count.toLocaleString()+'</td><td class="num" data-s="'+t.balance+'">'+money(t.balance)+'</td></tr>';});
  mount(h+'</tbody></table>');}
function vTeam(id){const t=teamById[id];if(!t)return mount('<h1>Team not found</h1>');
  let rk=null,st=null;for(const c of (compsByLeague[t.league_id]||[])){const i=c.standings.findIndex(s=>s.team_id==id);if(i>=0){rk=i+1;st=c.standings[i];break;}}
  const stats=[];if(rk)stats.push(statCell('Rank','#'+rk,rk===1?'gold':''));
  if(st){stats.push(statCell('Record',st.win+'–'+st.lose));stats.push(statCell('Win%',pct(st.win,st.win+st.lose)));}
  stats.push(statCell('Fans',t.fan_count.toLocaleString()));stats.push(statCell('Balance',money(t.balance),t.balance<0?'neg':''));
  let h=heroHeader(teamLogo(id,74),'Team',esc(t.name),lLink(t.league_id)+' · manager '+esc(t.manager),stats);
  if(t.rank_hist&&t.rank_hist.length>1){
    h+='<h2>Standings trend <small>last '+t.rank_hist.length+' days'+(rk?' · now #'+rk:'')+'</small></h2>'+spark(t.rank_hist,true,220,40);}
  const f=t.finance;
  if(f){h+='<h2>Business &amp; finances</h2>';
    h+='<div class="kv"><div>Transfer budget <b>'+money(f.transfer_budget)+'</b></div><div>Salary budget <b>'+money(f.salary_budget)+'</b></div><div>Scout budget <b>'+money(f.scout_budget)+'</b></div><div>Popularity <b>'+(f.popularity||0)+'</b></div><div>Fan momentum <b class="'+(f.fan_momentum>0?'pos':f.fan_momentum<0?'neg':'')+'">'+(f.fan_momentum>0?'+':'')+(f.fan_momentum||0)+'</b></div></div>';
    h+='<div class="kv"><div>🏟️ '+esc(f.stadium_name||'Stadium')+' <b>cap '+(f.stadium_capacity||0).toLocaleString()+'</b> · grade <b>'+grade(f.stadium_grade)+'</b></div><div>Home gate <b>'+money(f.entrance_income)+'</b> / '+(f.home_matches||0)+' games</div><div>Attendance <b>'+(f.home_attendance||0).toLocaleString()+'</b></div></div>';
    h+='<div class="kv"><div>Training facility <b>'+grade(f.training_grade)+'</b></div><div>Merch facility <b>'+grade(f.merch_grade)+'</b></div><div>Gaming house <b>'+grade(f.gaming_house)+'</b></div><div>Fan satisfaction <b>'+(f.fan_satisfaction??0)+'</b></div><div>Fan expectation <b>'+(f.fan_expectation??0)+'</b></div></div>';}
  h+='<h2>Roster</h2><table><thead><tr><th>Role</th><th>Player</th><th>Recent champions</th></tr></thead><tbody>';
  t.roster.forEach((aid,i)=>{const a=aid!=null?athById[aid]:null;h+='<tr><td>'+(POS[i]||('P'+i))+'</td><td>'+(a?aLink(aid):'—')+'</td><td class="chips">'+(a?a.recent_champions.map(c=>'<span>'+cLink(c)+'</span>').join(''):'')+'</td></tr>';});
  h+='</tbody></table>';
  const ms=D.matches.filter(m=>m.blue_team_id==id||m.red_team_id==id);
  if(ms.length){h+='<h2>Recent matches</h2><table><thead><tr><th>Opponent</th><th>Result</th></tr></thead><tbody>';
    ms.forEach(m=>{const opp=m.blue_team_id==id?m.red_team_id:m.blue_team_id;const won=(m.blue_team_id==id)===m.blue_win;h+='<tr><td>'+tLink(opp)+'</td><td class="'+(won?'win':'loss')+'"><a href="#/match/'+m.id+'">'+(won?'Win':'Loss')+'</a></td></tr>';});h+='</tbody></table>';}
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
function vPlayers(){let h='<h1>Players</h1><p class="sub">click a column to sort · '+D.athletes.length+' athletes</p><table class="s"><thead><tr><th>Player</th><th>Team</th><th data-num>Age</th><th data-num>M</th><th data-num>W</th><th data-num>Rating</th><th data-num>K</th><th data-num>D</th><th data-num>A</th><th data-num>MVP</th></tr></thead><tbody>';
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
  if(a.languages&&a.languages.length)h+='<h2>Communication</h2><div class="chips">'+a.languages.map(l=>{const st=Math.round((l.prof||0)/20);return '<span>Region '+l.region+' '+'★'.repeat(st)+'<span class="sub">'+'☆'.repeat(5-st)+'</span></span>';}).join('')+'</div>';
  if(a.attr){h+='<h2>Attributes</h2><table>'+ATTR_DEFS.map(d=>{const v=a.attr[d[1]]||0;return '<tr><td>'+d[0]+'</td><td class="num">'+v+'</td><td><div class="bar"><i style="width:'+(100*v/ATTR_MAX).toFixed(0)+'%"></i></div></td></tr>';}).join('')+'</table>';}
  if(a.soloranks&&a.soloranks.length){h+='<h2>Solo rank</h2><table class="s"><thead><tr><th>Region</th><th data-num>Rating</th><th data-num>W</th><th data-num>L</th><th data-num>Win%</th></tr></thead><tbody>'+
    a.soloranks.map(s=>'<tr><td>Region '+s.region+'</td><td class="num"><b>'+s.rating+'</b></td><td class="num">'+s.wins+'</td><td class="num">'+s.losses+'</td><td class="num">'+pct(s.wins,s.wins+s.losses)+'</td></tr>').join('')+'</tbody></table>';}
  if(a.seasons&&a.seasons.length){h+='<h2>Season history</h2><table class="s"><thead><tr><th data-num>Year</th><th>Role</th><th data-num>M</th><th data-num>W</th><th data-num>Win%</th><th>KDA</th><th data-num>Rating</th><th data-num>MVP</th></tr></thead><tbody>';
    a.seasons.forEach(se=>se.positions.forEach(p=>{h+='<tr><td class="num">'+se.year+'</td><td>'+roleTag(p.position)+'</td><td class="num">'+p.matches+'</td><td class="num">'+p.wins+'</td><td class="num">'+pct(p.wins,p.matches)+'</td><td class="num">'+p.kills+'/'+p.deaths+'/'+p.assists+'</td><td class="num">'+avgRating(p.rating,p.matches)+'</td><td class="num">'+p.mvp+'</td></tr>';}));
    h+='</tbody></table>';}
  const log=[];D.matches.forEach(m=>{const p=m.picks.find(p=>p.athlete_id==id);if(p){const won=p.blue===m.blue_win;const opp=p.blue?m.red_team_id:m.blue_team_id;log.push({m,p,won,opp});}});
  if(log.length){h+='<h2>Match log</h2><table><thead><tr><th>Champion</th><th>Role</th><th>Opponent</th><th>Result</th></tr></thead><tbody>';
    log.forEach(x=>{h+='<tr><td>'+cLink(x.p.champion)+'</td><td>'+roleTag(x.p.position)+'</td><td>'+tLink(x.opp)+'</td><td class="'+(x.won?'win':'loss')+'"><a href="#/match/'+x.m.id+'">'+(x.won?'Win':'Loss')+'</a></td></tr>';});h+='</tbody></table>';}
  mount(h);}
// Meta score = presence (pick+ban rate) lifted by win-rate over 50%.
function champMeta(c){if(!c.games||!c.picks)return null;const minGames=Math.max(3,c.games*0.03);if((c.picks+c.bans)<minGames)return null;
  const pres=100*(c.picks+c.bans)/c.games,wr=100*c.wins/c.picks;return {pres,wr,score:pres+(wr-50)};}
// Tiers are RELATIVE (quantile cut-offs) so they self-calibrate to roster size /
// game count instead of using absolute presence thresholds.
const TIER_CUTS=[['S',0.08],['A',0.25],['B',0.50],['C',0.80],['D',1.01]];
function vTierList(){const ranked=D.champions.map(c=>({c,m:champMeta(c)})).filter(x=>x.m).sort((a,b)=>b.m.score-a.m.score);
  if(ranked.length<2)return '';const n=ranked.length,buckets={};
  ranked.forEach((x,i)=>{const q=(i+1)/n,t=(TIER_CUTS.find(c=>q<=c[1])||TIER_CUTS[TIER_CUTS.length-1])[0];(buckets[t]=buckets[t]||[]).push(x);});
  let h='<h2>Tier list <small>presence + win-rate over last '+(D.champions[0]?D.champions[0].games:0)+' games · ranked vs the field</small></h2>';
  for(const [t] of TIER_CUTS){const row=buckets[t];if(!row||!row.length)continue;
    h+='<div class="tier"><span class="tlab tier-'+t+'">'+t+'</span><span class="tch">'+row.map(x=>'<span class="tchip" title="presence '+x.m.pres.toFixed(0)+'% · win '+x.m.wr.toFixed(0)+'%"><a href="#/champion/'+encodeURIComponent(x.c.name)+'">'+champIcon(x.c.name,30,true,'show')+esc(champName(x.c.name))+'</a></span>').join('')+'</span></div>';}
  return h;}
function vChampions(){const g=D.champions[0]?D.champions[0].games:0;let h='<h1>Champions</h1><p class="sub">pick/ban/win over last '+g+' games · click to sort</p>'+vTierList()+'<table class="s"><thead><tr><th>Champion</th><th data-num>Picks</th><th data-num>Pick%</th><th data-num>Bans</th><th data-num>Ban%</th><th data-num>Pres%</th><th data-num>Win%</th></tr></thead><tbody>';
  D.champions.forEach(c=>{const pr=c.games?100*(c.picks+c.bans)/c.games:0;h+='<tr><td>'+cLink(c.name,40)+'</td><td class="num">'+c.picks+'</td><td class="num" data-s="'+(c.games?c.picks/c.games:0)+'">'+pct(c.picks,c.games)+'</td><td class="num">'+c.bans+'</td><td class="num" data-s="'+(c.games?c.bans/c.games:0)+'">'+pct(c.bans,c.games)+'</td><td class="num" data-s="'+pr+'">'+pr.toFixed(1)+'%</td><td class="num" data-s="'+(c.picks?c.wins/c.picks:0)+'">'+pct(c.wins,c.picks)+'</td></tr>';});
  mount(h+'</tbody></table>');}
function vChampion(name){const c=champByName[name];
  const stats=c?[statCell('Games',c.games),statCell('Pick%',pct(c.picks,c.games)),statCell('Ban%',pct(c.bans,c.games)),statCell('Win%',pct(c.wins,c.picks),c.picks&&c.wins/c.picks>=0.5?'pos':(c.picks?'neg':''))]:[];
  let h=heroHeader(champIcon(name,74,true,'bare'),'Champion',esc(champName(name)),null,stats);
  if(c){let rr='';for(let i=0;i<5;i++){if(c.role_picks[i]>0)rr+='<tr><td>'+POS[i]+'</td><td class="num">'+c.role_picks[i]+'</td><td class="num">'+pct(c.role_wins[i],c.role_picks[i])+'</td></tr>';}
    if(rr)h+='<h2>By role</h2><table class="s"><thead><tr><th>Role</th><th data-num>Picks</th><th data-num>Win%</th></tr></thead><tbody>'+rr+'</tbody></table>';}
  const players={};D.matches.forEach(m=>m.picks.forEach(p=>{if(p.champion==name)players[p.athlete_id]=(players[p.athlete_id]||0)+1;}));
  const pr=Object.entries(players).sort((a,b)=>b[1]-a[1]);
  if(pr.length){h+='<h2>Played by</h2><table><thead><tr><th>Player</th><th data-num>Games</th></tr></thead><tbody>'+pr.map(e=>'<tr><td>'+aLink(e[0])+'</td><td class="num">'+e[1]+'</td></tr>').join('')+'</tbody></table>';}
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
  let h=heroHeader(badge(initials(l.name),hue(l.name),'crest',74),'League',esc(l.name),
    leader!=null?'Leader: '+tLink(leader):null,stats);
  (compsByLeague[l.id]||[]).forEach(c=>{h+='<h2>Standings</h2><table class="s"><thead><tr><th data-nosort>#</th><th>Team</th><th data-num>Pts</th><th data-num>W</th><th data-num>L</th><th data-num>Win%</th><th data-nosort>Trend</th></tr></thead><tbody>';
    c.standings.forEach((s,i)=>{const tt=teamById[s.team_id];h+='<tr'+(i===0?' class="lead"':'')+'><td>'+(i+1)+'</td><td>'+tLink(s.team_id)+'</td><td class="num"><b>'+s.points+'</b></td><td class="num">'+s.win+'</td><td class="num">'+s.lose+'</td><td class="num">'+pct(s.win,s.win+s.lose)+'</td><td>'+spark(tt&&tt.rank_hist,true,90,22)+'</td></tr>';});h+='</tbody></table>';});
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
      ps.map(p=>'<tr><td>'+roleTag(p.position)+'</td><td>'+aLink(p.athlete_id,40)+'</td><td>'+cLink(p.champion,40)+'</td><td class="num">'+(p.kills||0)+'</td><td class="num">'+(p.deaths||0)+'</td><td class="num">'+(p.deal||0).toLocaleString()+'</td><td class="num">'+(p.cs||0)+'</td><td class="chips">'+((p.items||[]).map(i=>{const ic=itemIcon(i,26);return ic?'<span class="ichip" title="'+esc(itemName(i))+'">'+ic+'</span>':'<span>'+esc(itemName(i))+'</span>';}).join('')||'<span class="sub">—</span>')+'</td></tr>').join('')+'</tbody></table>';};
  mount(h+side(true)+side(false));}
// ===== Newsroom: synthesized "reporter" stories from the exported data =====
function teamRank(tid){for(const c of D.competitions){const i=c.standings.findIndex(s=>s.team_id==tid);if(i>=0)return {rank:i+1,n:c.standings.length,s:c.standings[i]};}return null;}
function teamForm(tid,n){const r=[];for(const m of D.matches){if(m.blue_team_id==tid||m.red_team_id==tid){r.push((m.blue_team_id==tid)===m.blue_win);if(r.length>=n)break;}}return r;}
function streak(f){if(!f.length)return '';let s=1;for(let i=1;i<f.length;i++){if(f[i]===f[0])s++;else break;}return s>=2?(s+(f[0]?'-game win streak':'-game skid')):'';}
function deskResults(limit){
  const cand=D.matches.slice(0,40).map(m=>{const wT=m.blue_win?m.blue_team_id:m.red_team_id,lT=m.blue_win?m.red_team_id:m.blue_team_id;
    const wp=m.blue_win?(m.blue_perf||{}):(m.red_perf||{}),lp=m.blue_win?(m.red_perf||{}):(m.blue_perf||{});
    const kd=(wp.kills||0)-(lp.kills||0),gd=(wp.total_gold||0)-(lp.total_gold||0);
    const wR=teamRank(wT),lR=teamRank(lT),upset=!!(wR&&lR&&wR.rank>=lR.rank+3);
    let mvp=null,best=-1;m.picks.filter(p=>p.blue===m.blue_win).forEach(p=>{const sc=(p.kills||0)*2+(p.deal||0)/1500-(p.deaths||0);if(sc>best){best=sc;mvp=p;}});
    return {m,wT,lT,kd,gd,upset,mvp,score:(upset?120:0)+kd*3+gd/1200};});
  const UPV=['stun','shock','topple','ambush'],DOMV=['demolish','dismantle','run over','steamroll'],EDGV=['edge','squeak past','outlast','hold off'];
  const UPB=['pulled off the upset against','sent shockwaves through the league by beating','had no business beating — yet took down','pulled the rug out from under'];
  const pick=(arr,i)=>arr[i%arr.length];
  return cand.sort((a,b)=>b.score-a.score).slice(0,limit).map((s,i)=>{
    const w=tName(s.wT),l=tName(s.lT);
    const head=s.upset?(w+' '+pick(UPV,i)+' '+l):(w+' '+pick(s.kd>=10?DOMV:EDGV,i)+' '+l);
    let blurb=s.upset?(w+' '+pick(UPB,i)+' '+l):(w+' '+(s.kd>=10?'overpowered':'got past')+' '+l);
    if(s.mvp){const a=athById[s.mvp.athlete_id];blurb+=', powered by '+(a?a.name:'a standout')+'’s '+(s.mvp.kills||0)+' kills on '+champName(s.mvp.champion);}
    return {head,blurb:blurb+'.',tag:s.upset?'Upset':'Result',cls:s.upset?'up':'',link:'#/match/'+s.m.id,score:s.score,desk:'Results'};});
}
function deskStandings(limit){const out=[];
  D.leagues.forEach(l=>{const c=(compsByLeague[l.id]||[])[0];if(c&&c.standings[0]){const s=c.standings[0],st=streak(teamForm(s.team_id,6));
    out.push({head:tName(s.team_id)+' top '+l.name,blurb:tName(s.team_id)+' sit atop '+l.name+' at '+s.win+'–'+s.lose+(st?', riding a '+st:'')+'.',tag:'Standings',link:'#/league/'+l.id,score:40+s.points/5,desk:'Standings'});}});
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
// Game-native news: resolve a title key against window.NEWS_TEXT + substitute {binds}.
function newsText(key){let o=window.NEWS_TEXT;if(!o)return null;for(const k of String(key).split('.')){if(o==null)return null;o=o[k];}return typeof o==='string'?o:null;}
function resolveNews(it){let t=newsText(it.title);if(t==null)return null;(it.tb||[]).forEach(p=>{t=t.split('{'+p[0]+'}').join(p[1]);});return t;}
const OFFICE_TAGS={transfer:'Transfer',match:'Match',pre_match:'Preview',meta:'Meta',player:'Player',fan:'Fans',finance:'Finance',scout:'Scouting',training:'Training',facility:'Facility',league:'League',season:'Season',merch:'Merch',author:'Op-Ed',start_team:'League',start_recruit:'Recruiting',solo_rank_report:'Solo Rank'};
function deskOffice(limit){if(!window.NEWS_TEXT||!D.news||!D.news.length)return [];const out=[];
  for(const it of D.news){const head=resolveNews(it);if(!head)continue;const seg=it.title.split('.');const scope=seg[0]==='article'?seg[1]:seg[0];
    out.push({head,blurb:'— '+it.by+(it.date?' · '+it.date:''),tag:OFFICE_TAGS[scope]||'League',link:it.team!=null?'#/team/'+it.team:'#/news'});
    if(out.length>=limit)break;}
  return out;}
function vNews(){
  const R=deskResults(4),S=deskStandings(4),M=deskMeta(3),P=deskPlayers(3),all=[...R,...S,...M,...P];
  let lead=null;all.forEach(s=>{if(!lead||s.score>lead.score)lead=s;});
  let h=heroHeader('','Newsroom','The League Wire','Reports from across the leagues · '+(D.today||('#'+(D.updated||0))),[]);
  if(!all.length)h+='<p class="sub">No stories yet — play out some matches and the desks will fill in.</p>';
  if(lead)h+='<a class="lead-story" href="'+lead.link+'"><span class="ntag '+(lead.cls||'')+'">'+lead.tag+'</span><div class="lead-h">'+esc(lead.head)+'</div><p>'+esc(lead.blurb)+'</p><span class="byline">— The '+lead.desk+' Desk</span></a>';
  const card=s=>'<a class="ncard" href="'+s.link+'"><span class="ntag '+(s.cls||'')+'">'+s.tag+'</span><div class="nhead">'+esc(s.head)+'</div><div class="nblurb">'+esc(s.blurb)+'</div></a>';
  const desk=(title,route,list)=>{const ls=list.filter(s=>s!==lead).slice(0,3);if(!ls.length)return '';return '<section class="ndesk"><div class="ndesk-h"><h2>'+title+'</h2><a class="more" href="'+route+'">more →</a></div>'+ls.map(card).join('')+'</section>';};
  h+='<div class="nroom">'+desk('Results','#/matches',R)+desk('Standings','#/standings',S)+desk('Meta Watch','#/champions',M)+desk('Player Spotlight','#/players',P)+'</div>';
  const office=deskOffice(8);
  if(office.length)h+='<section class="ndesk office"><div class="ndesk-h"><h2>From the League Office <small>straight off the game wire</small></h2></div><div class="owrap">'+office.map(card).join('')+'</div></section>';
  mount(h);
}
function vSearch(q){q=String(q||'').toLowerCase();
  const tm=D.teams.filter(t=>t.name.toLowerCase().includes(q)).slice(0,40);
  const pl=D.athletes.filter(a=>a.name.toLowerCase().includes(q)).slice(0,60);
  const ch=D.champions.filter(c=>champName(c.name).toLowerCase().includes(q)).slice(0,40);
  let h='<h1>Search: '+esc(q)+'</h1><h2>Teams</h2><div class="chips">'+(tm.map(t=>'<span>'+tLink(t.id)+'</span>').join('')||'<span class="sub">none</span>')+'</div>';
  h+='<h2>Players</h2><div class="chips">'+(pl.map(a=>'<span>'+aLink(a.id)+'</span>').join('')||'<span class="sub">none</span>')+'</div>';
  h+='<h2>Champions</h2><div class="chips">'+(ch.map(c=>'<span>'+cLink(c.name)+'</span>').join('')||'<span class="sub">none</span>')+'</div>';mount(h);}
function setActiveNav(){const seg=location.hash.replace(/^#\/?/,'').split('/')[0]||'';
  const m={'':'#/',news:'#/news',teams:'#/teams',team:'#/teams',players:'#/players',player:'#/players',champions:'#/champions',champion:'#/champions',matches:'#/matches',match:'#/matches',leagues:'#/leagues',league:'#/leagues'};
  const want=m[seg]||'#/';document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')===want));}
function router(){setActiveNav();const p=location.hash.replace(/^#\/?/,'').split('/').map(decodeURIComponent);
  switch(p[0]){case '':return vStandings();case 'news':return vNews();case 'teams':return vTeams();case 'team':return vTeam(+p[1]);
    case 'players':return vPlayers();case 'player':return vPlayer(+p[1]);case 'champions':return vChampions();
    case 'champion':return vChampion(p.slice(1).join('/'));case 'matches':return vMatches();case 'match':return vMatch(+p[1]);
    case 'leagues':return vLeagues();case 'league':return vLeague(+p[1]);
    case 'search':return vSearch(p.slice(1).join('/'));default:return vStandings();}}
const curHash=()=>(location.hash&&location.hash!=='#')?location.hash:'#/';
addEventListener('hashchange',()=>{sessionStorage.setItem('hub_route',curHash());router();scrollTo(0,0);});
addEventListener('beforeunload',()=>{sessionStorage.setItem('hub_route',curHash());sessionStorage.setItem('hub_sy',scrollY);});
function setUpd(){const u=document.querySelector('#nav .upd');if(u)u.textContent='#'+(D.updated||0);}
// Swap in fresh data and re-render the current route IN PLACE (no page reload → no
// blink). Scroll is preserved; the nav (incl. the search box) is left intact, only the
// update counter ticks. Sort state on the current table resets, same as a reload would.
function applyData(d){if(!d)return;D=d;buildIndex();router();setUpd();}
// Hosted site only: poll league_data.json and apply it when the publish counter moves.
// The local file:// broadcast page can't fetch a sibling, so it keeps its <meta refresh>
// (the mod rewrites that whole file each tick); polling is skipped there.
function startPolling(){if(!/^https?:$/.test(location.protocol))return;
  setInterval(()=>{fetch('league_data.json',{cache:'no-store'}).then(r=>r.ok?r.json():null)
    .then(d=>{if(d&&d.updated!==D.updated)applyData(d);}).catch(()=>{});},20000);}
// A <meta refresh> reload can drop the URL fragment; restore the route before rendering.
const savedRoute=sessionStorage.getItem('hub_route');
if(savedRoute&&savedRoute!=='#/'&&(!location.hash||location.hash==='#'||location.hash==='#/')){history.replaceState(null,'',savedRoute);}
buildIndex();nav();router();spInit();
const sy=sessionStorage.getItem('hub_sy');if(sy)scrollTo(0,+sy);
startPolling();
