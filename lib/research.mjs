import {percentile,round,seriesFor,WINDOWS} from './analytics.mjs';
const DAY=86400000;
export const days=d=>Date.parse(d+'T00:00:00Z')/DAY;
export const iso=n=>new Date(n*DAY).toISOString().slice(0,10);
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>a.length>1?Math.sqrt(a.reduce((s,x)=>s+(x-avg(a))**2,0)/(a.length-1)):null;
export function historicalRanks(series,key='value'){
 const c=series.at(-1);if(!c)return {};
 const out={};for(const w of WINDOWS){const a=series.filter(p=>days(p.date)>days(c.date)-7*w&&Number.isFinite(p[key]));out[w]=a.length>=Math.ceil(.8*w)&&days(series[0].date)<=days(c.date)-7*w+7?round(percentile(a.map(p=>p[key]),c[key]),2):null;}
 out.all=series.length>=26?round(percentile(series.map(p=>p[key]),c[key]),2):null;return out;
}
export function optionSeries(futures,combined,group){
 const by=new Map(combined.filter(h=>h.p[group]).map(h=>[h.d,h]));
 return futures.filter(h=>h.p[group]&&by.has(h.d)&&h.oi>0).map(h=>{const c=by.get(h.d),fnet=h.p[group][0]-h.p[group][1],cnet=c.p[group][0]-c.p[group][1];return {date:h.d,futuresNet:fnet,combinedNet:cnet,net:cnet-fnet,value:100*(cnet-fnet)/h.oi,futuresOi:h.oi,optionEquivalentOi:c.oi-h.oi}});
}
export function optionSummary(futures,combined,group){
 if(!futures.length||!combined.length||futures.at(-1).d!==combined.at(-1).d)return {valid:false,reason:'Report dates differ'};
 const s=optionSeries(futures,combined,group),c=s.at(-1);if(!c||c.date!==futures.at(-1).d)return {valid:false,reason:'Latest category missing'};
 if(c.optionEquivalentOi< -2)return {valid:false,reason:'Combined OI is below futures OI'};
 const prev=s.find(p=>days(p.date)===days(c.date)-7);
 return {...c,valid:true,change:prev?c.net-prev.net:null,pct:historicalRanks(s),n:s.length,spark:s.slice(-52).map(p=>({date:p.date,value:round(p.value)}))};
}
export function trendModel(m){
 const h=m.history;if(!h||h.length<121)return null;
 const c=h.at(-1),v=h.map(p=>p[1]);if(!v.every(x=>Number.isFinite(x)&&x>0))return null;
 const legs=[20,60,120].map(n=>{const sma=avg(v.slice(-n)),flip=avg(v.slice(-(n-1)));return {days:n,sma:round(sma,8),signal:Math.sign(c[1]-sma),flip:round(flip,8),distance:round(100*(flip/c[1]-1),3)}});
 const r=v.slice(-21).slice(1).map((x,i)=>Math.log(x/v.slice(-21)[i])),vol=sd(r)*Math.sqrt(252)*100;
 const score=avg(legs.map(l=>l.signal));return {code:m.code,name:m.name,sector:m.sector,date:c[0],price:c[1],kind:m.kind,symbol:m.symbol,quote:m.quote,sourceUrl:m.sourceUrl,legs,score:round(score,3),state:score===1?'Long':score===-1?'Short':'Mixed',vol20:round(vol,2),change5:round(100*(c[1]/h.at(-6)[1]-1),2),nearest:legs.reduce((a,b)=>Math.abs(a.distance)<Math.abs(b.distance)?a:b),history:h.slice(-260).map((p,i)=>({date:p[0],price:p[1]}))};
}
export function nearestBefore(h,date,maxDays=4){let lo=0,hi=h.length;while(lo<hi){const m=(lo+hi)>>1;if(h[m][0]<=date)lo=m+1;else hi=m}const p=h[lo-1];return p&&days(date)-days(p[0])<=maxDays?p:null;}
export function nearestAfter(h,date,maxDays=4){let lo=0,hi=h.length;while(lo<hi){const m=(lo+hi)>>1;if(h[m][0]<date)lo=m+1;else hi=m}const p=h[lo];return p&&days(p[0])-days(date)<=maxDays?p:null;}
function solve(a,b){a=a.map((r,i)=>[...r,b[i]]);for(let i=0;i<b.length;i++){let pivot=i;for(let j=i+1;j<b.length;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;[a[i],a[pivot]]=[a[pivot],a[i]];if(Math.abs(a[i][i])<1e-10)return null;const d=a[i][i];a[i]=a[i].map(v=>v/d);for(let j=0;j<b.length;j++)if(j!==i){const x=a[j][i];a[j]=a[j].map((v,k)=>v-x*a[i][k]);}}return a.map(r=>r.at(-1));}
export function regression(samples){if(samples.length<20)return null;const xx=Array.from({length:3},()=>[0,0,0]),xy=[0,0,0];for(const s of samples)for(let i=0;i<3;i++){xy[i]+=s.x[i]*s.y;for(let j=0;j<3;j++)xx[i][j]+=s.x[i]*s.x[j];}return solve(xx,xy);}
const predict=(b,x)=>b.reduce((s,v,i)=>s+v*x[i],0);
export function positionNowcast(history,group,price,cme,nowDate){
 const s=seriesFor(history,group),last=s.at(-1),base={group,reportedDate:last?.date,reportedNet:last?.net,reportedNetOi:last?.netoi,oiDate:cme?.date,oi:cme?.oi,change1d:cme?.change,oiStatus:cme?.status,sourceUrl:cme?.sourceUrl};
 if(!last||!cme||!price)return {...base,status:'Missing price or OI',estimate:null};
 if(cme.date<=last.date||days(cme.date)-days(last.date)>10||days(nowDate)-days(cme.date)>5)return {...base,status:'Dates do not support a nowcast',estimate:null};
 const p0=nearestBefore(price.history,last.date),p1=nearestBefore(price.history,cme.date);
 if(!p0||!p1)return {...base,status:'Missing aligned price',estimate:null};
 const oiChange=100*(cme.oi/last.oi-1),priceChange=100*(p1[1]/p0[1]-1);Object.assign(base,{oiChange:round(oiChange,2),priceChange:round(priceChange,2),priceDate:p1[0],priceSourceUrl:price.sourceUrl});
 // Contract identity is pinned in research-markets. A very large change is a scope/reconciliation warning.
 if(Math.abs(oiChange)>30)return {...base,status:'OI scope/reconciliation check needed',estimate:null};
 const samples=[];for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i];if(days(b.date)-days(a.date)!==7)continue;const pa=nearestBefore(price.history,a.date),pb=nearestBefore(price.history,b.date);if(!pa||!pb)continue;samples.push({date:b.date,x:[1,100*(pb[1]/pa[1]-1),100*(b.oi/a.oi-1)],y:100*(b.net-a.net)/a.oi});}
 const recent=samples.slice(-182);if(recent.length<130)return {...base,status:'Insufficient model history',estimate:null,n:recent.length};
 const errors=[],actual=[];for(let i=recent.length-26;i<recent.length;i++){const b=regression(recent.slice(Math.max(0,i-156),i));if(b){errors.push(predict(b,recent[i].x)-recent[i].y);actual.push(recent[i].y);}}
 if(errors.length<26)return {...base,status:'Model validation unavailable',estimate:null};
 const mse=avg(errors.map(e=>e*e)),zero=avg(actual.map(y=>y*y)),skill=zero>0?1-mse/zero:null;
 Object.assign(base,{validationWeeks:26,skill:round(skill,3),rmse:round(Math.sqrt(mse),3),n:Math.min(156,recent.length)});
 if(skill==null||skill<=0)return {...base,status:'No improvement over unchanged positioning',estimate:null};
 const b=regression(recent.slice(-156));if(!b)return {...base,status:'Singular model',estimate:null};
 const fraction=Math.min(1,(days(cme.date)-days(last.date))/7),flow=predict(b,[fraction,priceChange,oiChange]),estimate=last.net+flow*last.oi/100,band=1.96*Math.sqrt(mse)*last.oi/100;
 if(Math.abs(estimate)>cme.oi)return {...base,status:'Estimate breaches OI bound',estimate:null};
 return {...base,status:'Experimental estimate',estimate:Math.round(estimate),estimateOi:round(100*estimate/cme.oi,2),low:Math.round(Math.max(-cme.oi,estimate-band)),high:Math.round(Math.min(cme.oi,estimate+band)),coefficients:b.map(v=>round(v,5))};
}
// Conservative embargoes for documented publication interruptions; this is not a complete historical vintage calendar.
export const DELAY_WINDOWS=[['2013-09-24','2013-11-12'],['2018-12-18','2019-03-12'],['2023-01-31','2023-03-28'],['2025-09-30','2026-01-06']];
export function excludedDate(d){return DELAY_WINDOWS.some(([a,b])=>d>=a&&d<=b);}
export function wilson(w,n){if(!n)return null;const z=1.96,p=w/n,den=1+z*z/n,c=(p+z*z/(2*n))/den,rad=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return [round(100*(c-rad),1),round(100*(c+rad),1)];}
export function studyExtremes(history,group,price,{threshold=10,window=156,lag=7}={}){
 const s=seriesFor(history,group),events=[],baseline=[],h=price.history;let previous=null,blockedUntil=-Infinity;
 function observation(p,rank,side){const entry=nearestAfter(h,iso(days(p.date)+lag));if(!entry)return null;const returns={};for(const w of [4,8,13]){const end=nearestAfter(h,iso(days(entry[0])+w*7));returns[w]=end?{value:100*(end[1]/entry[1]-1),end:end[0],exitPrice:end[1]}:null;}return {reportDate:p.date,entry:entry[0],entryPrice:entry[1],rank:round(rank,2),side,returns};}
 for(let i=0;i<s.length;i++){
  const p=s[i],cut=days(p.date)-window*7,a=s.slice(0,i+1).filter(x=>days(x.date)>cut);
  if(a.length<Math.ceil(.8*window)||days(s[0].date)>cut+7||excludedDate(p.date)){previous=null;continue;}
  const rank=percentile(a.map(x=>x.netoi),p.netoi),side=rank<=threshold?'lower':rank>=100-threshold?'upper':null;
  const entry=observation(p,rank,side);if(entry)baseline.push(entry);
  if(side&&side!==previous&&days(p.date)>=blockedUntil&&entry){events.push(entry);blockedUntil=days(entry.entry)+13*7;}
  previous=side;
 }
 const summaries=[];
 for(const side of ['lower','upper'])for(const w of [4,8,13]){
  const sample=events.filter(e=>e.side===side&&e.returns[w]),v=sample.map(e=>e.returns[w].value),sorted=[...v].sort((a,b)=>a-b),wins=v.filter(x=>side==='lower'?x>0:x<0).length,bv=baseline.filter(e=>e.returns[w]).map(e=>e.returns[w].value),late=sample.filter(e=>e.entry>='2020-01-01').map(e=>e.returns[w].value);
  summaries.push({side,weeks:w,n:v.length,mean:round(avg(v),2),median:v.length?round(v.length%2?sorted[Math.floor(v.length/2)]:(sorted[v.length/2-1]+sorted[v.length/2])/2,2):null,contrarianHit:v.length?round(100*wins/v.length,1):null,hitInterval:wilson(wins,v.length),baselineMean:round(avg(bv),2),baselineN:bv.length,post2020N:late.length,post2020Mean:round(avg(late),2),first:sample[0]?.entry,last:sample.at(-1)?.entry});
 }
 return {threshold,window,lag,summaries,events,eligibleWeeks:baseline.length};
}
export function parseSurveyCSV(text,nowDate){
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);const fields=lines.shift()?.split(',').map(s=>s.trim());
 if(fields?.join(',')!=='date,currency,usd_position_score,source_url')throw new Error('Use columns: date,currency,usd_position_score,source_url');
 const allowed=['CNY','KRW','SGD','IDR','TWD','INR','PHP','MYR','THB'],out=[],seen=new Set();
 for(const line of lines){const cols=line.split(',').map(x=>x.trim());if(cols.length!==4)throw new Error('Each row needs exactly four columns');const [date,currency,value,sourceUrl]=cols,score=Number(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(days(date))||iso(days(date))!==date||date>nowDate||!allowed.includes(currency)||value===''||!Number.isFinite(score)||Math.abs(score)>3)throw new Error('Invalid date, currency or score; scores must be −3 to +3');let u;try{u=new URL(sourceUrl)}catch{throw new Error('A source URL is required')}if(u.protocol!=='https:'||u.username||u.password)throw new Error('Use a public HTTPS source URL without credentials');const key=date+'/'+currency;if(seen.has(key))throw new Error('Duplicate date/currency');seen.add(key);out.push({date,currency,usdScore:score,localScore:-score,sourceUrl});}
 if(!out.length)throw new Error('CSV has no survey rows');if(new Set(out.map(r=>r.date)).size!==1)throw new Error('Import one survey date at a time');return out;
}
