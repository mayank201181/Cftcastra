import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {DATASETS,GROUPS,metrics,normalizeRecord,percentile,themeValue,PRESETS,classify,correlation} from '../lib/analytics.mjs';import {valuation} from '../lib/valuation.mjs';
let total=0;const current=[];
for(const [ds,def] of Object.entries(DATASETS)){
 const raw=JSON.parse(gunzipSync(fs.readFileSync(`data/${ds}.json.gz`))),snap=JSON.parse(fs.readFileSync(`public/data/${ds}.json`));assert.equal(raw.basis,def.basis);assert.equal(snap.markets.length,raw.catalog.length);
 const keys=new Set();for(const arr of raw.rows){const obj=Object.fromEntries(raw.fields.map((f,i)=>[f,arr[i]]));const k=arr[0]+'/'+arr[1];assert(!keys.has(k));keys.add(k);
  for(const side of [0,1]){let sum=0;for(const f of Object.values(GROUPS[def.family])){assert(obj[f[side]]>=0);sum+=obj[f[side]]+(f[2]?obj[f[2]]||0:0);}assert(Math.abs(sum-obj.open_interest_all)<=5,`${ds} ${k}: side reconciliation`);}
 }total+=raw.rows.length;
 for(const market of snap.markets){const h=JSON.parse(fs.readFileSync(`public/data/history/${ds}/${market.code}.json`)).history;assert.equal(h.at(-1).d,market.date);for(const [g,m] of Object.entries(market.groups)){assert.equal(m.net,m.long-m.short);assert.equal(m.gross,m.long+m.short+2*m.spread);assert(Math.abs(m.netoi-100*m.net/market.oi)<1e-8);const previous=h.find(r=>Date.parse(r.d)===Date.parse(market.date)-7*86400000);if(previous)assert.equal(m.dNet,m.net-(previous.p[g][0]-previous.p[g][1]));for(const p of Object.values(m.pct))assert(p===null||(p>=0&&p<=100));}
  if(def.basis==='FutOnly'&&def.family!=='legacy')current.push(market);
 }
 console.log('PASS',ds,raw.rows.length,'rows; positions, OI, net, gross, changes and rank bounds');
}
assert.equal(percentile([1,2,2,3],2),50);assert.equal(percentile([5,5,5],5),50);
assert(Math.abs(valuation('097741',{'JPY=X':{price:150,date:'2026-10-20'}},'2026-10-20').usdPerContract-12500000/150)<1e-8);
assert.equal(valuation('002602',{'ZC=F':{price:400,date:'2026-10-20'}},'2026-10-20').usdPerContract,20000);
assert.equal(valuation('239747',{'RTY=F':{price:2000,date:'2026-10-20'}},'2026-10-20').usdPerContract,10000);
assert.equal(valuation('042601',{},'2026-10-20').usdPerContract,200000);
assert.equal(valuation('099741',{'EURUSD=X':{price:1.1,date:'2026-10-21'}},'2026-10-20'),null);
assert.equal(current.find(m=>m.code==='134741').groups.leveraged.pct[520],null,'SOFR must not show a full 10Y percentile');
assert.equal(classify({commodity_subgroup_name:'LIVESTOCK',market_and_exchange_names:'LEAN HOGS'}),'Commodities');
for(const t of PRESETS){assert.equal(new Set(t.legs.map(l=>l[0])).size,t.legs.length);assert(t.legs.every(l=>current.some(m=>m.code===l[0])),'preset leg missing');const v=themeValue(t.legs,current);assert(v.score===null||(v.score>=0&&v.score<=100));assert(!t.legs.some(l=>['13874A','13874U','209742','209747','124603','124608'].includes(l[0])));}
const b=themeValue([['x',1],['y',-1]],[{code:'x',family:'tff',groups:{leveraged:{pct:{156:80}}}},{code:'y',family:'tff',groups:{leveraged:{pct:{156:20}}}}]);assert.equal(b.score,80);
assert.equal(correlation(Array.from({length:30},(_,i)=>i),Array.from({length:30},(_,i)=>-i)),-1);
console.log(`Analytics verified: ${total.toLocaleString()} source rows; FX direction, cent quotes, rate notional, short history, themes and correlation checked.`);
