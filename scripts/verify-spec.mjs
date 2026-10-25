import assert from 'node:assert/strict';
import fs from 'node:fs';
import {comparisonDatasets,comparisonRows,divergence,comparisonHistory,comparisonExport} from '../lib/spec-comparison.mjs';
const read=ds=>JSON.parse(fs.readFileSync(`public/data/${ds}.json`));
const snapshots=comparisonDatasets('FutOnly').map(read),rows=comparisonRows(snapshots,'FutOnly');
assert.equal(rows.length,new Set(snapshots.flatMap(s=>s.markets.map(m=>m.code))).size);
const currentAUD=rows.find(r=>r.code==='232741');
// The golden official-data assertions apply to the captured 20 October release.
if(currentAUD.lenses.funds.date==='2026-10-20'&&currentAUD.lenses.legacy.date==='2026-10-20'){
const aud=currentAUD;
assert.equal(aud.lenses.funds.net,52497);
assert.equal(aud.lenses.legacy.net,-127292);
assert.equal(aud.lenses.asset.net,-128739);
assert.equal(aud.lenses.funds.dNet,1906);
assert.equal(aud.lenses.legacy.dNet,-9993);
assert.equal(aud.lenses.asset.dNet,-12819);
assert.equal(aud.lenses.funds.pct[156],82.37);
assert.equal(aud.lenses.legacy.pct[156],24.68);
assert.equal(aud.lenses.asset.pct[156],15.06);
}
// Keep flag behavior independent of future weekly data.
const aud=structuredClone(currentAUD);
const golden={funds:[52497,82.37],legacy:[-127292,24.68],asset:[-128739,15.06]};
for(const [key,[net,rank]] of Object.entries(golden)){aud.lenses[key].net=net;aud.lenses[key].pct[156]=rank;aud.lenses[key].date='2026-10-20';}
assert.deepEqual(divergence(aud).opposite,['Funds / Legacy','Funds / asset managers']);
assert(Math.abs(divergence(aud).maxGap-67.31)<1e-8);
assert.equal(divergence(aud).rankSplit,true);
const combined=comparisonRows(comparisonDatasets('Combined').map(read),'Combined').find(r=>r.code==='232741');
if(combined.lenses.funds.date==='2026-10-20'&&combined.lenses.legacy.date==='2026-10-20'){assert.equal(combined.lenses.funds.net,47606);assert.equal(combined.lenses.legacy.net,-131309);}
assert.throws(()=>comparisonRows([...snapshots,read('yw9f-hn96')],'FutOnly'),/Mixed report/);
const stale=structuredClone(aud);stale.lenses.legacy.date='2026-10-13';
assert.equal(divergence(stale).label,'Dates differ');
assert.deepEqual(divergence(stale).opposite,[]);
assert.equal(divergence(stale).maxGap,null);
const partial=structuredClone(aud);delete partial.lenses.legacy;
assert.equal(divergence(partial).label,'Missing lens');
assert.equal(divergence(partial).rankSplit,false);
const flat=structuredClone(aud);for(const l of Object.values(flat.lenses)){l.net=0;l.pct[156]=50;}
assert.equal(divergence(flat).label,'No opposite nets');
assert.equal(divergence(flat).rankSplit,false);
const sameDirection=structuredClone(aud);for(const l of Object.values(sameDirection.lenses))l.net=Math.abs(l.net);
assert.deepEqual(divergence(sameDirection).opposite,[]);
assert.equal(divergence(sameDirection).rankSplit,true);
const gold=rows.find(r=>r.code==='088691');
assert.equal(gold.lenses.funds.label,'Managed money');
assert.equal(gold.lenses.asset,undefined);
assert.equal(divergence(gold).valid,true);
const sofr=rows.find(r=>r.code==='134741').lenses.funds;
if(Date.parse(sofr.date)-Date.parse(sofr.first)<519*7*86400000)assert.equal(sofr.pct[520],null);
// Deliberately distinct missing dates establish that the chart preserves gaps.
const fixture={code:'x',lenses:{funds:{dataset:'tff',group:'leveraged',date:'2026-10-20'},legacy:{dataset:'legacy',group:'noncommercial',date:'2026-10-20'}}};
const histories={'tff/x/2026-10-20':{history:[{d:'2026-10-13',oi:100,p:{leveraged:[60,20,0]}},{d:'2026-10-20',oi:200,p:{leveraged:[60,20,0]}}]},'legacy/x/2026-10-20':{history:[{d:'2026-10-20',oi:200,p:{noncommercial:[30,90,0]}}]}};
const history=comparisonHistory(fixture,histories);
assert.equal(history[0].funds,40);assert.equal(history[0].legacy,null);
assert.equal(history[1].funds,20);assert.equal(history[1].legacy,-30);
const csv=comparisonExport([aud]);assert.equal(csv.length,4);
assert.equal(csv[1][4],'Leveraged funds');assert.equal(csv[2][4],'Legacy noncommercials');
assert(csv.slice(1).every(r=>r.length===csv[0].length));
for(const row of rows)for(const [key,l] of Object.entries(row.lenses)){
 const source=snapshots.find(s=>s.dataset===l.dataset).markets.find(m=>m.code===row.code);
 assert.equal(l.net,source.groups[l.group].net);
 assert.deepEqual(l.pct,source.groups[l.group].pct);
 assert.equal(l.date,source.date);
}
console.log('PASS three-lens comparison: '+rows.length+' contracts, AUD official figures, independent ranks, combined basis, date guards, missing categories, chart gaps and CSV.');
