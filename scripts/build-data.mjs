import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';
import {DATASETS,normalizeRecord,summarize} from '../lib/analytics.mjs';import {valuation} from '../lib/valuation.mjs';
const out='public/data';fs.mkdirSync(out,{recursive:true});
const prices=fs.existsSync('data/prices.json')?JSON.parse(fs.readFileSync('data/prices.json','utf8')):{};
const manifest={generatedAt:new Date().toISOString(),historyFloor:'2006-01-01',datasets:{},prices};
for(const dataset of Object.keys(DATASETS)){
 const a=JSON.parse(gunzipSync(fs.readFileSync(`data/${dataset}.json.gz`))),by=new Map(),family=DATASETS[dataset].family;
 for(const row of a.rows){const raw=Object.fromEntries(a.fields.map((f,i)=>[f,row[i]])),h=normalizeRecord(raw,family);if(h){const code=raw.cftc_contract_market_code;if(!by.has(code))by.set(code,[]);by.get(code).push(h);}}
 const markets=[],dir=path.join(out,'history',dataset);fs.mkdirSync(dir,{recursive:true});let count=0;
 for(const m of a.catalog){const h=by.get(m.cftc_contract_market_code);if(!h?.length)continue;h.sort((a,b)=>a.d.localeCompare(b.d));const code=m.cftc_contract_market_code;
  const summary=summarize(m,h,dataset,valuation(code,prices,h.at(-1).d));markets.push(summary);count+=h.length;
  fs.writeFileSync(path.join(dir,`${code}.json`),JSON.stringify({dataset,code,meta:m,history:h,source:a.source,retrievedAt:a.retrieved_at}));
 }
 const asof=markets.map(m=>m.date).sort().at(-1),snapshot={dataset,asof,retrievedAt:a.retrieved_at,source:`https://publicreporting.cftc.gov/resource/${dataset}.json`,markets};
 fs.writeFileSync(path.join(out,`${dataset}.json`),JSON.stringify(snapshot));manifest.datasets[dataset]={asof,markets:markets.length,rows:count,retrievedAt:a.retrieved_at};console.log(dataset,markets.length,count,asof);
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest));
