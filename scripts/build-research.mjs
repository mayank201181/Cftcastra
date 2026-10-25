import fs from 'node:fs';
import zlib from 'node:zlib';
import {DATASETS,GROUP_LABELS,selectedGroup,PRESETS,themeValue,round} from '../lib/analytics.mjs';
import {optionSummary,trendModel,positionNowcast,studyExtremes,historicalRanks,days} from '../lib/research.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const prices=JSON.parse(zlib.gunzipSync(fs.readFileSync('data/research-prices.json.gz'))),input=read('data/research-inputs.json'),config=read('data/research-markets.json');
const now=new Date().toISOString(),today=now.slice(0,10),snap=Object.fromEntries(Object.keys(DATASETS).map(id=>[id,read(`public/data/${id}.json`)])),cache=new Map();
function hist(id,code){const key=id+'/'+code;if(!cache.has(key)){const path=`public/data/history/${id}/${code}.json`;cache.set(key,fs.existsSync(path)?read(path).history:[])}return cache.get(key)}
const modern=[...snap['gpe5-46if'].markets,...snap['72hh-3qpy'].markets].filter(m=>m.core),legacy=snap['6dca-aqww'].markets;
const trends=config.map(m=>prices.markets[m.code]&&trendModel(prices.markets[m.code])).filter(Boolean);
const trendBy=new Map(trends.map(t=>[t.code,t]));
const options=[];
for(const [fid,cid] of [['gpe5-46if','yw9f-hn96'],['72hh-3qpy','kh3c-gbw2'],['6dca-aqww','jun7-fc8e']]){
 const comb=new Map(snap[cid].markets.map(m=>[m.code,m]));
 for(const m of snap[fid].markets.filter(m=>m.core)){
  const c=comb.get(m.code);if(!c)continue;
  const fh=hist(fid,m.code),ch=hist(cid,m.code);
  for(const group of Object.keys(m.groups)){
   if(!c.groups[group])continue;const v=optionSummary(fh,ch,group);
   options.push({code:m.code,name:m.name,sector:m.sector,family:m.family,group,groupName:GROUP_LABELS[group],futuresDataset:fid,combinedDataset:cid,futuresRank:m.groups[group]?.pct[156],combinedRank:c.groups[group]?.pct[156],...v});
  }
 }
}
const latestCme=Object.values(Object.fromEntries(input.cme.map(r=>[r.code,r])));
const nowcasts=[];
for(const c of latestCme.filter(c=>!c.noCot)){
 for(const [id,groups] of [['gpe5-46if',['leveraged','asset_manager']],['6dca-aqww',['noncommercial']]])for(const group of groups){
  nowcasts.push({code:c.code,name:c.name,dataset:id,groupName:GROUP_LABELS[group],...positionNowcast(hist(id,c.code),group,prices.markets[c.code],c,today)});
 }
}
const studies=[];
for(const m of config.filter(m=>!m.noCot)){
 const price=prices.markets[m.backtest?'bt:'+m.code:m.code];if(!price||price.kind==='nearby futures')continue;
 const market=modern.find(r=>r.code===m.code);if(!market)continue;
 const variants=[[market.dataset,selectedGroup(market,'spec')],['6dca-aqww','noncommercial']];
 if(market.family==='tff')variants.push([market.dataset,'asset_manager']);
 for(const [id,group] of variants){const h=hist(id,m.code);if(!h.length)continue;
  for(const threshold of [10,5]){
   const study=studyExtremes(h,group,price,{threshold});
   studies.push({code:m.code,name:m.name,sector:m.sector,group,groupName:GROUP_LABELS[group],dataset:id,priceKind:price.kind,priceSymbol:price.symbol,quote:price.quote,priceDate:price.asof,priceSourceUrl:price.sourceUrl,...study});
  }
 }
}
function foreignSummary(rows){const groups=Object.groupBy(rows,r=>[r.code,r.basis,r.units].join('/'));return Object.values(groups).map(s=>{s.sort((a,b)=>a.date.localeCompare(b.date));const c=s.at(-1),prev=s.find(p=>days(p.date)===days(c.date)-7);return {...c,change:prev?c.net-prev.net:null,pct:historicalRanks(s,'netoi'),n:s.length,history:s.map(p=>({date:p.date,value:round(p.netoi,3),net:p.net,oi:p.oi}))}})}
const ice=foreignSummary(input.ice),ttf=foreignSummary(input.ttf);
const cotDate=modern.map(m=>m.date).sort().at(-1),themes=PRESETS.map(p=>{const t=themeValue(p.legs,modern,'spec',156);return {id:p.id,name:p.name,description:p.description,shock:p.shock,score:t.score,coverage:t.coverage,total:t.total,legs:t.parts.map(x=>({code:x.code,name:x.m?.name,weight:x.weight,rank:x.p,date:x.m?.date}))}});
// Evidence rules, not an opaque generated recommendation. Only current matched observations enter the lead notes.
const notes=[],num=(v,d=0)=>v==null?'—':v.toLocaleString('en-US',{maximumFractionDigits:d}),signed=(v,d=0)=>(v>0?'+':'')+num(v,d);
const fresh=m=>m.date===cotDate&&days(today)-days(m.date)<=10;
const splits=modern.filter(fresh).map(m=>{const a=m.groups[selectedGroup(m,'spec')],l=legacy.find(x=>x.code===m.code&&x.date===m.date)?.groups.noncommercial;return {m,a,l,gap:a&&l?Math.abs(a.netoi-l.netoi):0}}).filter(r=>r.a&&r.l&&r.a.net*r.l.net<0).sort((a,b)=>b.gap-a.gap);
for(const {m,a,l,gap} of splits.slice(0,2))notes.push({id:'split-'+m.code,type:'Category disagreement',date:m.date,priority:100+gap,title:`${m.name}: “speculators” give opposite answers`,facts:`${GROUP_LABELS[selectedGroup(m,'spec')]} ${signed(a.net)} contracts (${signed(a.netoi,1)}% OI); Legacy noncommercials ${signed(l.net)} (${signed(l.netoi,1)}% OI). Legacy rank: ${num(l.pct[26],0)} / 100 over 6M, ${num(l.pct[156],0)} / 100 over 3Y.`,implication:`A headline calling ${m.name} net ${l.net<0?'short':'long'} can be true for Legacy and false for the fund lens. The historical lookback also changes how extreme that position looks.`,check:'The disagreement ends when the two net positions share a sign. These overlapping classifications must never be added.',tab:'Spec positioning',source:`https://publicreporting.cftc.gov/resource/${m.dataset}.json`});
const pressure=modern.filter(fresh).map(m=>({m,s:m.groups[selectedGroup(m,'spec')],t:trendBy.get(m.code)})).filter(x=>x.s?.pct[156]!=null&&x.t&&days(today)-days(x.t.date)<=5&&Math.abs(x.s.pct[156]-50)>=40).sort((a,b)=>Math.abs(b.s.pct[156]-50)-Math.abs(a.s.pct[156]-50));
for(const {m,s,t} of pressure.slice(0,3)){
 const upper=s.pct[156]>=90,adverse=s.net*t.change5<0;
 const exposure=s.net>0?'net long':'net short',pain=s.net>0?'further price weakness':'a sustained price rise';
 notes.push({id:'extreme-'+m.code,type:adverse?'Extreme + adverse price move':'Positioning extreme',date:m.date,priority:adverse?95:75,title:`${m.name}: rank ${num(s.pct[156],0)} / 100, ${exposure}`,facts:`Fund net ${signed(s.net)} contracts; net/OI ${signed(s.netoi,1)}%. Five-session price change ${signed(t.change5,2)}% through ${t.date}. Weekly net flow ${signed(s.flowOi,1)}% of prior OI.`,implication:`Positioning is at the ${upper?'high':'low'} end of its own history, while still ${exposure}. The adverse scenario for the current net exposure is ${pain}. A historical rank does not determine the sign of the position.`,check:`Next-close ${t.nearest.days}D moving-average switch at ${num(t.nearest.flip,5)} (${t.quote}). The trend proxy is ${t.state.toLowerCase()}; a move in favour of existing net exposure weakens the immediate washout case.`,tab:'CTA trends',source:t.sourceUrl});
}
const rotation=modern.filter(fresh).map(m=>({m,s:m.groups[selectedGroup(m,'spec')]})).filter(x=>x.s?.flowOi!=null).sort((a,b)=>Math.abs(b.s.flowOi)-Math.abs(a.s.flowOi))[0];
if(rotation)notes.push({id:'rotation',type:'Weekly rotation',date:rotation.m.date,priority:80,title:`${rotation.m.name}: largest core-market fund rotation`,facts:`Net changed ${signed(rotation.s.dNet)} contracts, or ${signed(rotation.s.flowOi,1)}% of prior OI. Longs changed ${signed(rotation.s.dLong)} and shorts ${signed(rotation.s.dShort)}.`,implication:'The decomposition distinguishes long liquidation from new shorts, or short covering from new longs. It does not prove an equivalent cash flow.',check:'Watch the next reported long/short decomposition and whether price follows the position change.',tab:rotation.m.sector,source:`https://publicreporting.cftc.gov/resource/${rotation.m.dataset}.json`});
const nearest=trends.filter(t=>days(today)-days(t.date)<=5).sort((a,b)=>Math.abs(a.nearest.distance)-Math.abs(b.nearest.distance))[0];
if(nearest)notes.push({id:'flip',type:'Model level',date:nearest.date,priority:70,title:`${nearest.name}: closest trend switch`,facts:`The ${nearest.nearest.days}D rule switches at next close ${num(nearest.nearest.flip,6)} ${nearest.quote}, ${signed(nearest.nearest.distance,2)}% from the last close. The three-speed model is ${nearest.state.toLowerCase()}.`,implication:'This is a transparent price-based sensitivity level. Actual CTAs have different rules, volatility targets and positions.',check:'A closing-price crossing changes this model vote; an intraday touch does not. No fund flow or AUM estimate is implied.',tab:'CTA trends',source:nearest.sourceUrl});
const wt=options.find(o=>o.code==='067651'&&o.group==='managed'&&o.valid);
if(wt&&days(today)-days(wt.date)<=10)notes.push({id:'options',type:'Options contribution',date:wt.date,priority:65,title:'WTI: distinguish option delta from option buying',facts:`Managed-money net option contribution ${signed(wt.net)} futures equivalents. Futures-only rank ${num(wt.futuresRank,0)}; combined rank ${num(wt.combinedRank,0)}; contribution’s own 3Y rank ${num(wt.pct[156],0)}.`,implication:'The difference measures signed option delta exposure. Calls, puts, writes, closures and changing deltas can all affect it; a percentile gap cannot identify call buying.',check:'Use the matched net difference and its weekly change. Trade direction needs transaction-level information.',tab:'Options',source:'https://www.cftc.gov/MarketReports/CommitmentsofTraders/ExplanatoryNotes/index.htm'});
const audStudy=studies.find(r=>r.code==='232741'&&r.group==='noncommercial'&&r.threshold===10),audStats=audStudy?.summaries.find(r=>r.side==='lower'&&r.weeks===8);
if(audStats?.n>=5)notes.push({id:'historical-check',type:'Historical check',date:audStudy.priceDate,priority:60,title:'AUD: test the squeeze story against history',facts:`After ${audStats.n} independent low-rank Legacy episodes, the 8-week AUD spot return averaged ${signed(audStats.mean,2)}%; the positive-return hit rate was ${num(audStats.contrarianHit,0)}% (Wilson interval ${audStats.hitInterval.map(x=>num(x,0)).join('–')}%). Unconditional weekly-start mean: ${signed(audStats.baselineMean,2)}%.`,implication:'This fixed 10th-percentile rule is a check on a simple short-squeeze narrative, not evidence for a reliable timing strategy. The current 3Y rank may not qualify as an event.',check:'Inspect the 4/8/13-week results, sample sizes and 5% sensitivity. Revised history, the assumed release embargo and spot returns without carry limit the inference.',tab:'Backtests',source:audStudy.priceSourceUrl});
notes.sort((a,b)=>b.priority-a.priority);
const output={version:1,builtAt:now,retrievedAt:input.retrievedAt,cotDate,priceDate:trends.map(t=>t.date).sort().at(-1),notes:notes.slice(0,10),themes,trends,nowcasts,options,studies,ice,ttf,jpx:input.jpx,strikes:input.strikes||[],asianOi:latestCme.filter(r=>r.noCot),statuses:input.statuses,priceIssues:prices.issues,priceCoverage:{available:trends.length,requested:config.length},methodology:{delayWindows:[['2013-09-24','2013-11-12'],['2018-12-18','2019-03-12'],['2023-01-31','2023-03-28'],['2025-09-30','2026-01-06']]}};
fs.mkdirSync('public/data',{recursive:true});fs.writeFileSync('public/data/research.json',JSON.stringify(output));
console.log(`Research: ${trends.length} trends, ${nowcasts.length} nowcasts (${nowcasts.filter(x=>x.estimate!=null).length} pass), ${options.length} option lenses, ${studies.length} conditional studies, ${notes.length} conclusions`);
