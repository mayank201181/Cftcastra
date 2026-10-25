import assert from 'node:assert/strict';
import fs from 'node:fs';
import {optionSeries,optionSummary,trendModel,regression,studyExtremes,positionNowcast,parseSurveyCSV,iso,days,wilson,nearestBefore,nearestAfter,excludedDate} from '../lib/research.mjs';
const record=(d,net,oi=100)=>({d,oi,p:{leveraged:[50+net/2,50-net/2,0]}});
const fut=[record('2026-10-13',20),record('2026-10-20',10)],comb=[record('2026-10-13',30,140),record('2026-10-20',35,160)];
const opt=optionSummary(fut,comb,'leveraged');assert.equal(opt.net,25);assert.equal(opt.change,15);assert.equal(opt.value,25);assert.equal(opt.optionEquivalentOi,60);assert.equal(opt.pct[156],null);
assert.equal(optionSummary(fut,comb.slice(0,1),'leveraged').valid,false);assert.equal(optionSummary(fut,[record('2026-10-20',35,90)],'leveraged').valid,false);
assert.equal(optionSeries(fut,comb,'managed').length,0);assert.equal(optionSummary([fut[1]],[comb[1]],'leveraged').change,null);
const ph=Array.from({length:140},(_,i)=>[iso(days('2026-01-01')+i),100+i]);const trend=trendModel({history:ph});
assert.equal(trend.state,'Long');for(const l of trend.legs){const last=ph.slice(-(l.days-1)).map(x=>x[1]);const sma=(last.reduce((a,b)=>a+b,0)+l.flip)/l.days;assert(Math.abs(sma-l.flip)<1e-7);assert(l.flip<ph.at(-1)[1])}
assert.equal(nearestBefore(ph,'2025-01-01'),null);assert.equal(nearestAfter(ph,'2027-01-01'),null);assert.equal(nearestAfter(ph,ph[20][0])[0],ph[20][0]);assert.equal(nearestBefore(ph,ph[20][0])[0],ph[20][0]);
const train=Array.from({length:100},(_,i)=>({x:[1,i/10,(i%7)-3],y:2+3*i/10-4*((i%7)-3)}));const coefficients=regression(train);coefficients.forEach((v,i)=>assert(Math.abs(v-[2,3,-4][i])<1e-8));assert.equal(regression(Array.from({length:30},()=>({x:[1,2,2],y:1}))),null);
assert.equal(positionNowcast(fut,'leveraged',{history:ph},{date:'2026-10-13',oi:120},'2026-10-25').estimate,null);
assert.equal(positionNowcast(fut,'leveraged',{history:ph},{date:'2026-10-23',oi:120},'2026-11-20').estimate,null);
// Synthetic alternating extreme cycles: verify publication embargo, non-overlap and return math.
const start=days('2007-01-02'),history=Array.from({length:650},(_,i)=>record(iso(start+i*7),30*Math.sin(i/11)+i*.01,100));
const priceHistory=Array.from({length:650*7+100},(_,i)=>[iso(start+i),100*Math.exp(i*.0001)]);
const study=studyExtremes(history,'leveraged',{history:priceHistory});assert(study.events.length>8);
for(let i=0;i<study.events.length;i++){const e=study.events[i];assert(days(e.entry)-days(e.reportDate)>=7);assert(!excludedDate(e.reportDate));if(i)assert(days(e.entry)-days(study.events[i-1].entry)>=91);for(const w of [4,8,13])if(e.returns[w])assert(Math.abs(e.returns[w].value-100*(Math.exp(w*7*.0001)-1))<1e-8)}
const earlier=studyExtremes(history.slice(0,500),'leveraged',{history:priceHistory.slice(0,500*7)});assert.deepEqual(earlier.events.map(e=>[e.reportDate,e.rank]),study.events.filter(e=>days(e.entry)<start+500*7).map(e=>[e.reportDate,e.rank]));
for(const row of study.summaries)if(row.n){assert.equal(row.contrarianHit,row.side==='lower'?100:0);assert(row.hitInterval[0]>=0&&row.hitInterval[1]<=100)}
assert(wilson(1,1)[0]<50);assert(wilson(0,1)[1]>50);assert.equal(wilson(0,0),null);
const header='date,currency,usd_position_score,source_url\n',valid=header+'2026-10-01,KRW,1.25,https://www.reuters.com/markets/';assert.equal(parseSurveyCSV(valid,'2026-10-25')[0].localScore,-1.25);
for(const row of ['2026-10-26,KRW,1,https://example.com','2026-02-30,KRW,1,https://example.com','2026-10-01,CNH,1,https://example.com','2026-10-01,KRW,4,https://example.com','2026-10-01,KRW,,https://example.com','2026-10-01,KRW,1,javascript:alert(1)','2026-10-01,KRW,1,https://user:password@example.com'])assert.throws(()=>parseSurveyCSV(header+row,'2026-10-25'));
assert.throws(()=>parseSurveyCSV(valid+'\n2026-10-01,KRW,1,https://example.com','2026-10-25'));
if(fs.existsSync('public/data/research.json')){const d=JSON.parse(fs.readFileSync('public/data/research.json'));assert(d.notes.length>0);assert(d.trends.length>=20);assert(d.options.length>100);assert(d.studies.length>40);for(const r of d.nowcasts.filter(x=>x.estimate!=null)){assert(r.skill>0);assert(r.validationWeeks===26);assert(Math.abs(r.estimate)<=r.oi);assert(r.low<=r.estimate&&r.high>=r.estimate)}for(const r of d.options.filter(x=>x.valid))assert.equal(r.net,r.combinedNet-r.futuresNet);for(const t of d.trends)assert(t.legs.every(l=>l.flip>0));}
console.log('Research checks passed: matched option arithmetic, next-close flips, regression, stale gates, historical timing, non-overlap, future-data independence, survey validation and built archive.');
