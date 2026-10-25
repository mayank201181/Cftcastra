export const DATASETS = {
 'gpe5-46if':{family:'tff',basis:'FutOnly',label:'TFF · futures only'},
 'yw9f-hn96':{family:'tff',basis:'Combined',label:'TFF · futures + options'},
 '72hh-3qpy':{family:'disaggregated',basis:'FutOnly',label:'Disaggregated · futures only'},
 'kh3c-gbw2':{family:'disaggregated',basis:'Combined',label:'Disaggregated · futures + options'},
 '6dca-aqww':{family:'legacy',basis:'FutOnly',label:'Legacy · futures only'},
 'jun7-fc8e':{family:'legacy',basis:'Combined',label:'Legacy · futures + options'},
};
export const GROUPS = {
 tff:{dealer:['dealer_positions_long_all','dealer_positions_short_all','dealer_positions_spread_all'],asset_manager:['asset_mgr_positions_long','asset_mgr_positions_short','asset_mgr_positions_spread'],leveraged:['lev_money_positions_long','lev_money_positions_short','lev_money_positions_spread'],other:['other_rept_positions_long','other_rept_positions_short','other_rept_positions_spread'],nonreportable:['nonrept_positions_long_all','nonrept_positions_short_all',null]},
 disaggregated:{producer:['prod_merc_positions_long','prod_merc_positions_short',null],swap:['swap_positions_long_all','swap__positions_short_all','swap__positions_spread_all'],managed:['m_money_positions_long_all','m_money_positions_short_all','m_money_positions_spread'],other:['other_rept_positions_long','other_rept_positions_short','other_rept_positions_spread'],nonreportable:['nonrept_positions_long_all','nonrept_positions_short_all',null]},
 legacy:{noncommercial:['noncomm_positions_long_all','noncomm_positions_short_all','noncomm_postions_spread_all'],commercial:['comm_positions_long_all','comm_positions_short_all',null],nonreportable:['nonrept_positions_long_all','nonrept_positions_short_all',null]}
};
export const GROUP_LABELS={leveraged:'Leveraged funds',asset_manager:'Asset managers',dealer:'Dealers',managed:'Managed money',producer:'Producers / merchants',swap:'Swap dealers',other:'Other reportables',nonreportable:'Nonreportables',noncommercial:'Noncommercials',commercial:'Commercials'};
export const WINDOWS=[26,52,156,260,520];
export const NAMES={
 '099741':'EUR','097741':'JPY','096742':'GBP','232741':'AUD','112741':'NZD','090741':'CAD','092741':'CHF','095741':'MXN','102741':'BRL','122741':'ZAR','098662':'US dollar index','299741':'EUR/GBP','399741':'EUR/JPY',
 '042601':'US 2Y Treasury','044601':'US 5Y Treasury','043602':'US 10Y Treasury','043607':'Ultra 10Y Treasury','020601':'US Treasury bond','020604':'Ultra Treasury bond','045601':'Fed funds','134741':'3M SOFR','134742':'1M SOFR','047745':'€STR',
 '13874+':'S&P 500 · consolidated','13874A':'S&P 500 · E-mini','20974+':'Nasdaq 100 · consolidated','209742':'Nasdaq 100 · E-mini','12460+':'Dow · consolidated','124603':'Dow · E-mini','239742':'Russell 2000','1170E1':'VIX','240743':'Nikkei 225 · JPY','244041':'MSCI EAFE','244042':'MSCI EM',
 '133741':'Bitcoin · CME','146021':'Ether · CME','067651':'WTI crude','06765A':'WTI financial','067411':'WTI · ICE','06765T':'Brent last day','023651':'Henry Hub natural gas','111659':'RBOB gasoline','022651':'ULSD / heating oil',
 '088691':'Gold','084691':'Silver','085692':'Copper','076651':'Platinum','075651':'Palladium','002602':'Corn','001602':'Wheat · SRW','001612':'Wheat · HRW','005602':'Soybeans','007601':'Soybean oil','026603':'Soybean meal','083731':'Coffee','080732':'Sugar #11','073732':'Cocoa','033661':'Cotton','054642':'Lean hogs','057642':'Live cattle','061641':'Feeder cattle','040701':'Orange juice'
};
export const CORE=new Set(Object.keys(NAMES).filter(x=>!['13874A','209742','124603','067411','06765A','299741','399741','047745'].includes(x)));
export function classify(m){
 const s=(m.commodity_subgroup_name||'').toUpperCase(), n=(m.market_and_exchange_names||'').toUpperCase();
 if(/CURRENC|FOREIGN EXCHANGE/.test(s)||/DOLLAR|FRANC|PESO|POUND|JAPANESE YEN|EURO FX|RAND|REAL -|XRATE|USD INDEX/.test(n))return 'Foreign exchange';
 if(/INTEREST|BOND/.test(s)||/UST |SOFR|FED FUNDS|SHORT TERM RATE|ERIS|EURODOLLAR|CREDIT FUTURES|DURATION-HEDGED/.test(n))return 'Rates';
 if(/CRYPTO/.test(s)||/BITCOIN|ETHER|CRYPTO|PERP|NANO|MICRO SOL|^SOL -|^XRP|AVALANCHE/.test(n))return 'Crypto';
 if(/(^|\s)STOCK|EQUITY|VOLATILITY/.test(s)||/S&P|NASDAQ|DJIA|DOW JONES|RUSSELL|MSCI|NIKKEI|VIX|TECH100/.test(n))return 'Equities';
 return 'Commodities';
}
export function percentile(a,x){const v=a.filter(Number.isFinite);return v.length?100*(v.filter(y=>y<x).length+v.filter(y=>y===x).length/2)/v.length:null;}
export function zscore(a,x){if(a.length<26)return null;const avg=a.reduce((s,v)=>s+v,0)/a.length,sd=Math.sqrt(a.reduce((s,v)=>s+(v-avg)**2,0)/(a.length-1));return sd>0?(x-avg)/sd:null;}
export function round(v,n=4){return Number.isFinite(v)?Math.round(v*10**n)/10**n:null;}
const day=s=>Date.parse(s+'T00:00:00Z')/86400000;
export function normalizeRecord(raw,family){
 const oi=Number(raw.open_interest_all);if(!Number.isFinite(oi)||oi<=0)return null;
 const p={};for(const [group,fields] of Object.entries(GROUPS[family])){
  const vals=fields.map(f=>f===null?0:raw[f]===undefined||raw[f]===null||raw[f]==='.'?null:Number(raw[f]));
  if(vals.slice(0,2).some(x=>x===null||!Number.isFinite(x)))continue;p[group]=vals;
 }
 return {d:raw.report_date_as_yyyy_mm_dd.slice(0,10),oi,p,traders:num(raw.traders_tot_all),c4l:num(raw.conc_gross_le_4_tdr_long),c4s:num(raw.conc_gross_le_4_tdr_short),c8l:num(raw.conc_gross_le_8_tdr_long),c8s:num(raw.conc_gross_le_8_tdr_short)};
}
function num(v){return v===undefined||v===null||v==='.'?null:Number(v);}
export function seriesFor(history,group){return history.filter(h=>h.p[group]).map(h=>({date:h.d,oi:h.oi,long:h.p[group][0],short:h.p[group][1],spread:h.p[group][2],net:h.p[group][0]-h.p[group][1],netoi:100*(h.p[group][0]-h.p[group][1])/h.oi}));}
export function metrics(history,group){
 const s=seriesFor(history,group);if(!s.length)return null;const c=s.at(-1),d=day(c.date),prev=s.find(x=>day(x.date)===d-7),p4=s.find(x=>day(x.date)===d-28),pct={},counts={};
 for(const w of WINDOWS){const a=s.filter(x=>day(x.date)>d-w*7);counts[w]=a.length;pct[w]=a.length>=Math.ceil(w*.8)&&day(s[0].date)<=d-w*7+7?round(percentile(a.map(x=>x.netoi),c.netoi),2):null;}
 const all=s.map(x=>x.netoi),a3=s.filter(x=>day(x.date)>d-156*7).map(x=>x.netoi);
 const flow=s.slice(1).map((x,i)=>day(x.date)-day(s[i].date)===7?100*(x.net-s[i].net)/s[i].oi:null).filter(Number.isFinite);
 return {...c,longSide:c.long+(c.spread||0),shortSide:c.short+(c.spread||0),gross:c.long+c.short+2*(c.spread||0),longoi:100*c.long/c.oi,shortoi:100*c.short/c.oi,
  dNet:prev?c.net-prev.net:null,dLong:prev?c.long-prev.long:null,dShort:prev?c.short-prev.short:null,dOi:prev?c.oi-prev.oi:null,d4Net:p4?c.net-p4.net:null,dNetOi:prev?c.netoi-prev.netoi:null,flowOi:prev?100*(c.net-prev.net)/prev.oi:null,
  pct:{...pct,all:s.length>=26?round(percentile(all,c.netoi),2):null},counts,z3:counts[156]>=125?round(zscore(a3,c.netoi)):null,cotIndex3:counts[156]>=125&&Math.max(...a3)>Math.min(...a3)?round(100*(c.netoi-Math.min(...a3))/(Math.max(...a3)-Math.min(...a3))):null,
  flowPct:prev&&flow.length>=26?round(percentile(flow.slice(-156),100*(c.net-prev.net)/prev.oi),2):null,n:s.length,first:s[0].date,spark:s.slice(-26).map(x=>round(x.netoi,2))};
}
export function summarize(meta,history,dataset,valuation=null){
 const family=DATASETS[dataset].family,groups={};for(const g of Object.keys(GROUPS[family]))groups[g]=metrics(history,g);
 const c=history.at(-1);return {dataset,code:meta.cftc_contract_market_code,name:NAMES[meta.cftc_contract_market_code]||meta.market_and_exchange_names.split(' - ')[0].trim(),fullName:meta.market_and_exchange_names,units:meta.contract_units,sector:classify(meta),subgroup:meta.commodity_subgroup_name||'Other',core:CORE.has(meta.cftc_contract_market_code),consolidated:/consolidated/i.test(meta.market_and_exchange_names),family,basis:DATASETS[dataset].basis,date:c.d,oi:c.oi,traders:c.traders,c4l:c.c4l,c4s:c.c4s,c8l:c.c8l,c8s:c.c8s,groups,valuation};
}
export function selectedGroup(m,selected='spec'){if(selected==='spec')return m.family==='tff'?'leveraged':m.family==='legacy'?'noncommercial':'managed';if(selected==='asset')return m.family==='tff'?'asset_manager':m.family==='legacy'?'commercial':'producer';return selected;}
export function correlation(a,b){if(a.length<26||a.length!==b.length)return null;const ma=a.reduce((s,x)=>s+x,0)/a.length,mb=b.reduce((s,x)=>s+x,0)/b.length;let xy=0,xx=0,yy=0;for(let i=0;i<a.length;i++){xy+=(a[i]-ma)*(b[i]-mb);xx+=(a[i]-ma)**2;yy+=(b[i]-mb)**2;}return xx&&yy?xy/Math.sqrt(xx*yy):null;}
export function flowCorrelation(h1,h2,g1,g2,weeks=156){
 const make=(h,g)=>{const s=seriesFor(h,g);return new Map(s.slice(1).filter((x,i)=>day(x.date)-day(s[i].date)===7).map(x=>{const i=s.indexOf(x);return [x.date,x.netoi-s[i-1].netoi]}));};
 const a=make(h1,g1),b=make(h2,g2),dates=[...a.keys()].filter(d=>b.has(d)).sort().slice(-weeks);return {r:correlation(dates.map(d=>a.get(d)),dates.map(d=>b.get(d))),n:dates.length};
}
export const PRESETS=[
 {id:'risk-on',name:'Risk-on',description:'Equity beta + cyclical FX; short yen.',legs:[['13874+',1],['239742',1],['232741',1],['095741',1],['097741',-1]],shock:'Equity sell-off, AUD/MXN lower, JPY higher'},
 {id:'defensive',name:'Defensive / risk-off',description:'Duration, gold and safe-haven FX; short equities.',legs:[['043602',1],['088691',1],['097741',1],['092741',1],['13874+',-1]],shock:'Growth rebound, yields higher, equities rally'},
 {id:'reflation',name:'Reflation',description:'Long industrial commodities and AUD; short duration.',legs:[['085692',1],['067651',1],['232741',1],['043602',-1]],shock:'Demand disappointment; commodities and AUD lower'},
 {id:'disinflation',name:'Disinflation / soft landing',description:'Long duration and equities; short oil.',legs:[['043602',1],['13874+',1],['067651',-1]],shock:'Inflation shock; yields and oil higher'},
 {id:'usd',name:'Long USD',description:'USD index plus short major foreign currencies.',legs:[['098662',1],['099741',-1],['232741',-1],['096742',-1],['097741',-1]],shock:'Broad dollar decline'},
 {id:'audjpy',name:'AUD/JPY proxy',description:'Long AUD and short JPY; two USD futures legs.',legs:[['232741',1],['097741',-1]],shock:'Carry unwind: AUD lower and JPY higher'},
 {id:'duration',name:'Long US duration',description:'A positioning composite, not a DV01-neutral portfolio.',legs:[['042601',1],['044601',1],['043602',1],['020601',1]],shock:'Bearish rates repricing; Treasury futures lower'},
 {id:'metals',name:'Precious metals',description:'Gold, silver and platinum managed-money positioning.',legs:[['088691',1],['084691',1],['076651',1]],shock:'Real yields and dollar higher'},
 {id:'tech',name:'Tech leadership',description:'Long Nasdaq versus short small caps.',legs:[['20974+',1],['239742',-1]],shock:'Rotation from megacaps into small caps'}
];
export function themeValue(legs,rows,group='spec',window=156){
 const parts=legs.map(([code,weight])=>{const m=rows.find(x=>x.code===code),g=m?selectedGroup(m,group):null,p=m?.groups[g]?.pct[window];return {code,weight,m,g,p,aligned:p==null?null:weight>=0?p:100-p};});
 const valid=parts.filter(p=>p.aligned!==null),weight=valid.reduce((a,p)=>a+Math.abs(p.weight),0);
 return {parts,coverage:valid.length,total:parts.length,score:valid.length===parts.length&&weight?valid.reduce((a,p)=>a+p.aligned*Math.abs(p.weight),0)/weight:null};
}
