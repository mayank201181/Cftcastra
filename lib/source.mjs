import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';
import {DATASETS,GROUPS,normalizeRecord,summarize} from './analytics.mjs';import {valuation} from './valuation.mjs';
export async function cftc(dataset,params){
 if(!DATASETS[dataset])throw new Error('Unknown dataset');
 const u=new URL(`https://publicreporting.cftc.gov/resource/${dataset}.json`);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
 const r=await fetch(u,{headers:{Accept:'application/json'},next:{revalidate:3600},signal:AbortSignal.timeout(40000)});if(!r.ok)throw new Error(`CFTC returned HTTP ${r.status}`);const a=await r.json();if(!Array.isArray(a))throw new Error('CFTC returned a non-table response');return a;
}
export function readSeed(dataset){return JSON.parse(gunzipSync(fs.readFileSync(path.join(process.cwd(),'data',dataset+'.json.gz'))));}
export async function liveSnapshot(dataset){
 const seed=readSeed(dataset),family=DATASETS[dataset].family,basis=DATASETS[dataset].basis,latest=seed.rows.at(-1)[0],since=new Date(Date.parse(latest)-35*86400000).toISOString().slice(0,10);
 const rows=await cftc(dataset,{'$where':`report_date_as_yyyy_mm_dd >= '${since}T00:00:00' AND futonly_or_combined = '${basis}'`,'$limit':'50000','$order':'report_date_as_yyyy_mm_dd,cftc_contract_market_code'});
 if(!rows.length)throw new Error('CFTC returned no recent rows; retained snapshot has been preserved.');
 const metas=new Map(seed.catalog.map(m=>[m.cftc_contract_market_code,m])),by=new Map();
 for(const arr of seed.rows){const raw=Object.fromEntries(seed.fields.map((f,i)=>[f,arr[i]])),h=normalizeRecord(raw,family);if(h){const c=raw.cftc_contract_market_code;if(!by.has(c))by.set(c,new Map());by.get(c).set(h.d,h);}}
 let asof=latest;for(const raw of rows){if(raw.futonly_or_combined!==basis)throw new Error('Report basis mismatch');const h=normalizeRecord(raw,family);if(!h)continue;const c=raw.cftc_contract_market_code;if(!by.has(c))by.set(c,new Map());by.get(c).set(h.d,h);metas.set(c,raw);if(h.d>asof)asof=h.d;}
 const prices=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data/prices.json'),'utf8')),markets=[];
 for(const [code,dates] of by){const h=[...dates.values()].sort((a,b)=>a.d.localeCompare(b.d));if(h.at(-1).d!==asof)continue;markets.push(summarize(metas.get(code),h,dataset,valuation(code,prices,asof)));}
 return {dataset,asof,retrievedAt:new Date().toISOString(),source:`https://publicreporting.cftc.gov/resource/${dataset}.json`,markets,live:true,priceNote:'Price dates are shown separately. Automated archive refresh updates price proxies.'};
}
