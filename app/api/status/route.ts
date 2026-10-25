import {DATASETS} from '../../../lib/analytics.mjs';import {cftc} from '../../../lib/source.mjs';
export const maxDuration=60;
export async function GET(){const results=await Promise.all(Object.keys(DATASETS).map(async ds=>{try{const a=await cftc(ds,{'$select':'max(report_date_as_yyyy_mm_dd) as latest'});return {dataset:ds,latest:a[0]?.latest?.slice(0,10),ok:true};}catch(e){return {dataset:ds,ok:false,error:String(e.message||e)};}}));return Response.json({checkedAt:new Date().toISOString(),results});}
