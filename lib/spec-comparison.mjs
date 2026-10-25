import {DATASETS, seriesFor} from './analytics.mjs';

export const SPEC_WINDOWS = [['26','6M'],['52','1Y'],['156','3Y'],['260','5Y'],['520','10Y'],['all','All retained']];
export const LENS_ORDER = ['funds','legacy','asset'];
export function comparisonDatasets(basis){
 if(basis==='FutOnly')return ['gpe5-46if','72hh-3qpy','6dca-aqww'];
 if(basis==='Combined')return ['yw9f-hn96','kh3c-gbw2','jun7-fc8e'];
 throw new Error('Unknown report basis');
}
export function comparisonRows(snapshots,basis){
 const ids=comparisonDatasets(basis),byCode=new Map();
 for(const snapshot of snapshots){
  if(!ids.includes(snapshot.dataset))throw new Error('Mixed report bases in comparison');
  const family=DATASETS[snapshot.dataset].family;
  for(const m of snapshot.markets){
   if(m.basis!==basis||m.dataset!==snapshot.dataset||m.family!==family)throw new Error('Inconsistent comparison source');
   if(!byCode.has(m.code))byCode.set(m.code,{code:m.code,name:m.name,sector:m.sector,core:m.core,basis,fullName:m.fullName,lenses:{}});
   const row=byCode.get(m.code);
   const lens=(key,group,label)=>{
    if(m.groups[group])row.lenses[key]={...m.groups[group],group,label,dataset:m.dataset,date:m.groups[group].date||m.date,oi:m.groups[group].oi??m.oi,basis,valuation:m.valuation};
   };
   if(family==='legacy')lens('legacy','noncommercial','Legacy noncommercials');
   else if(family==='tff'){lens('funds','leveraged','Leveraged funds');lens('asset','asset_manager','Asset managers');}
   else lens('funds','managed','Managed money');
  }
 }
 return [...byCode.values()];
}
export function divergence(row,window='156'){
 const {funds,legacy,asset}=row.lenses;
 const pairs=[['Funds / Legacy',funds,legacy],['Funds / asset managers',funds,asset],['Legacy / asset managers',legacy,asset]];
 const opposite=[],gaps=[];let dateMismatch=false,basisMismatch=false;
 for(const [label,a,b] of pairs){
  if(!a||!b)continue;
  if(a.basis!==b.basis){basisMismatch=true;continue;}
  if(a.date!==b.date){dateMismatch=true;continue;}
  if(Number.isFinite(a.net)&&Number.isFinite(b.net)&&a.net*b.net<0)opposite.push(label);
  const pa=a.pct?.[window],pb=b.pct?.[window];
  if(Number.isFinite(pa)&&Number.isFinite(pb))gaps.push(Math.abs(pa-pb));
 }
 const complete=!!funds&&!!legacy&&(row.sector==='Commodities'||!!asset);
 // A partial or mixed-date snapshot is not a valid cross-lens signal.
 const valid=complete&&!dateMismatch&&!basisMismatch;
 const maxGap=valid&&gaps.length?Math.max(...gaps):null;
 const label=basisMismatch?'Bases differ':dateMismatch?'Dates differ':!complete?'Missing lens':opposite.length?'Opposite nets':'No opposite nets';
 return {valid,label,opposite:valid?opposite:[],maxGap,rankSplit:maxGap!==null&&maxGap>=50,score:valid?(opposite.length?3:maxGap>=50?2:1):0};
}
export function comparisonHistory(row,histories,weeks=260,metric='netoi'){
 const byDate=new Map(),latest=LENS_ORDER.map(k=>row.lenses[k]?.date).filter(Boolean).sort().at(-1);
 const cutoff=latest?Date.parse(latest)-weeks*7*86400000:Infinity;
 for(const key of LENS_ORDER){
  const l=row.lenses[key];if(!l)continue;
  const h=histories[`${l.dataset}/${row.code}/${l.date}`]?.history;
  if(!h)continue;
  for(const p of seriesFor(h,l.group)){
   if(p.date>l.date||Date.parse(p.date)<=cutoff)continue;
   if(!byDate.has(p.date))byDate.set(p.date,{date:p.date,funds:null,legacy:null,asset:null});
   byDate.get(p.date)[key]=p[metric];
  }
 }
 return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function comparisonExport(rows,window='156'){
 const header=['Market','Code','Sector','Basis','Participant','Report date','Net contracts','Weekly net change','Net / OI %','Open interest',...SPEC_WINDOWS.map(([,n])=>n+' percentile'),'Opposite-net pairs','Rank comparison window','Max rank gap pp','Signal status','Source'];
 const output=[header];
 for(const row of rows){const d=divergence(row,window);for(const k of LENS_ORDER){const l=row.lenses[k];if(l)output.push([row.name,row.code,row.sector,row.basis,l.label,l.date,l.net,l.dNet,l.netoi,l.oi,...SPEC_WINDOWS.map(([w])=>l.pct?.[w]??null),d.opposite.join('; '),SPEC_WINDOWS.find(([w])=>w===String(window))?.[1]||window,d.maxGap,d.label,`https://publicreporting.cftc.gov/resource/${l.dataset}.json`]);}}
 return output;
}
