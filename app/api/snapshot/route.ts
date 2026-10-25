import {DATASETS} from '../../../lib/analytics.mjs';import {liveSnapshot} from '../../../lib/source.mjs';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(request:Request){const ds=new URL(request.url).searchParams.get('dataset');if(!DATASETS[ds])return Response.json({error:'Invalid dataset'},{status:400});try{return Response.json(await liveSnapshot(ds),{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}});}catch(e){return Response.json({error:String(e.message||e),retainedSnapshotAvailable:true},{status:502});}}
