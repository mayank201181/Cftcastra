'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Download,RefreshCw,Search,ArrowUpRight} from 'lucide-react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine,Legend} from 'recharts';
import {comparisonDatasets,comparisonRows,divergence,comparisonHistory,comparisonExport,SPEC_WINDOWS,LENS_ORDER} from '../lib/spec-comparison.mjs';

const COLORS={funds:'#167d68',legacy:'#b97725',asset:'#476fbc'};
const ROLES={funds:'Tactical speculative proxy',legacy:'Traditional broad speculative benchmark',asset:'Institutional exposure and hedging context'};
const NAMES={funds:'Leveraged funds / managed money',legacy:'Legacy noncommercials',asset:'Asset managers'};
const fmt=(x,d=0)=>Number.isFinite(x)?new Intl.NumberFormat('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}).format(x):'—';
const signed=(x,d=0)=>Number.isFinite(x)?`${x>0?'+':''}${fmt(x,d)}`:'—';
const dateText=s=>s?new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
const rankColor=v=>v==null?'var(--muted)':v>=90?'var(--red)':v<=10?'var(--blue)':'var(--green)';
function Rank({value}){return <span className="spec-rank" style={{color:rankColor(value)}}>{fmt(value,0)}<i><b style={{width:`${value??0}%`,background:rankColor(value)}}/></i></span>}
function saveCSV(name,rows){const content=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const url=URL.createObjectURL(new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function json(url,signal){const r=await fetch(url,{signal});if(!r.ok)throw new Error('Data unavailable');return r.json()}

export default function SpecComparison({basis,universe,stars,refreshTick,onBusy,onDate}){
 const [snapshots,setSnapshots]=useState<any[]>([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const [sector,setSector]=useState('Foreign exchange'),[search,setSearch]=useState(''),[code,setCode]=useState('232741'),[lookback,setLookback]=useState('156'),[onlySplit,setOnlySplit]=useState(false),[sort,setSort]=useState({key:'flag',direction:-1}),[page,setPage]=useState(1);
 const [histories,setHistories]=useState<any>({}),[historyError,setHistoryError]=useState(''),[historyLoading,setHistoryLoading]=useState(false),[range,setRange]=useState(260),[metric,setMetric]=useState('netoi');
 const lastRefresh=useRef(refreshTick),latestRefresh=useRef(0),currentBasis=useRef(basis);
 currentBasis.current=basis;
 const ids=useMemo(()=>comparisonDatasets(basis),[basis]);
 useEffect(()=>{const controller=new AbortController();latestRefresh.current+=1;setRefreshing(false);setLoading(true);setSnapshots([]);setError('');setStatus('');onDate(null);
  Promise.all(ids.map(id=>json(`/data/${id}.json`,controller.signal))).then(a=>{comparisonRows(a,basis);if(!controller.signal.aborted)setSnapshots(a)}).catch(e=>{if(!controller.signal.aborted)setError('The saved comparison could not be loaded. Retry the sources below.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[basis,ids,onDate]);
 useEffect(()=>{onBusy(loading||refreshing);return()=>onBusy(false)},[loading,refreshing,onBusy]);
 useEffect(()=>{const dates=snapshots.map(s=>s.asof).filter(Boolean).sort();if(dates.length)onDate(dates.at(-1))},[snapshots,onDate]);
 async function refresh(){const requestedBasis=basis,request=++latestRefresh.current;setRefreshing(true);setStatus('Checking all three report families at CFTC…');setError('');
  const results=await Promise.allSettled(ids.map(id=>json(`/api/snapshot?dataset=${id}`,AbortSignal.timeout(65000))));
  if(currentBasis.current!==requestedBasis||request!==latestRefresh.current)return;
  const good=results.filter(r=>r.status==='fulfilled').map((r:any)=>r.value);
  try{comparisonRows(good,basis);setSnapshots(old=>[...old.filter(s=>!good.some(g=>g.dataset===s.dataset)),...good]);setHistories({});setStatus(good.length===ids.length?'All three CFTC report families checked. Each lens retains its own history and percentile.':`${good.length}/${ids.length} sources checked. Saved data retained for unavailable sources; mismatched dates are flagged.`)}catch{setError('Inconsistent source response. The prior comparison has been retained.')}
  setRefreshing(false);
 }
 useEffect(()=>{if(refreshTick!==lastRefresh.current){lastRefresh.current=refreshTick;void refresh()}},[refreshTick]);
 const allRows=useMemo(()=>comparisonRows(snapshots.filter(s=>ids.includes(s.dataset)),basis),[snapshots,basis,ids]);
 const markets=useMemo(()=>allRows.filter(m=>(universe==='all'||(universe==='core'?m.core:stars.includes(m.code)))&&(sector==='All markets'||m.sector===sector)).sort((a,b)=>a.name.localeCompare(b.name)),[allRows,universe,stars,sector]);
 const selected=markets.find(m=>m.code===code)||markets[0];
 const flagged=useMemo(()=>markets.filter(m=>{const d=divergence(m,lookback);return d.opposite.length||d.rankSplit}),[markets,lookback]);
 const filtered=useMemo(()=>markets.filter(m=>(!search||`${m.name} ${m.code} ${m.fullName}`.toLowerCase().includes(search.toLowerCase()))&&(!onlySplit||flagged.includes(m))),[markets,search,onlySplit,flagged]);
 function sortValue(row,key){const d=divergence(row,lookback);if(key==='name')return row.name;if(key==='flag')return d.score;if(key==='gap')return d.maxGap;const [lens,field]=key.split('.');return field==='rank'?row.lenses[lens]?.pct?.[lookback]:row.lenses[lens]?.[field]}
 const sorted=useMemo(()=>[...filtered].sort((a,b)=>{const x=sortValue(a,sort.key),y=sortValue(b,sort.key);if(x==null)return y==null?0:1;if(y==null)return -1;return (typeof x==='string'?x.localeCompare(y):x-y)*sort.direction||a.name.localeCompare(b.name)}),[filtered,sort,lookback]);
 useEffect(()=>setPage(1),[sector,universe,search,onlySplit,sort,lookback]);
 const selectedKey=selected?`${basis}/${selected.code}/`+LENS_ORDER.map(k=>selected.lenses[k]?.date||'').join('/'):'none';
 useEffect(()=>{if(!selected)return;let canceled=false;setHistoryError('');setHistoryLoading(true);const lenses=LENS_ORDER.map(k=>selected.lenses[k]).filter(Boolean),unique=[...new Map(lenses.map(l=>[l.dataset,l])).values()] as any[];
  Promise.allSettled(unique.map(async l=>{const key=`${l.dataset}/${selected.code}/${l.date}`;if(histories[key])return;let result;try{result=await json(`/data/history/${l.dataset}/${encodeURIComponent(selected.code)}.json`,AbortSignal.timeout(15000));if(result.history?.at(-1)?.d!==l.date)throw new Error('Saved date differs')}catch{result=await json(`/api/history?dataset=${l.dataset}&code=${encodeURIComponent(selected.code)}`,AbortSignal.timeout(65000))}if(!Array.isArray(result.history))throw new Error('History unavailable');if(!canceled)setHistories(h=>({...h,[key]:result}))})).then(results=>{if(!canceled){setHistoryLoading(false);if(results.some(r=>r.status==='rejected'))setHistoryError('Some history could not be loaded. Missing series are omitted; the available lines are shown.')}});
  return()=>{canceled=true};
 },[selectedKey,snapshots]);
 const chartData=useMemo(()=>selected?comparisonHistory(selected,histories,range,metric):[],[selected,histories,range,metric]);
 const check=selected?divergence(selected,lookback):null;
 const lookbackName=SPEC_WINDOWS.find(([w])=>w===lookback)?.[1];
 const columns=[['name','Market'],['flag','Comparison'],['funds.netoi','Funds net / OI'],['funds.rank',`Funds ${lookbackName} rank`],['legacy.netoi','Legacy net / OI'],['legacy.rank',`Legacy ${lookbackName} rank`],['asset.netoi','AM net / OI'],['asset.rank',`AM ${lookbackName} rank`],['gap','Max rank gap']];

 return <div className="spec-comparison">
  <div className="notice subtle"><b>Three distinct readings.</b> Funds are the tactical proxy; Legacy is the traditional speculative benchmark; asset managers add institutional context. These overlapping classifications must not be added together. None identifies the intent of every trade.</div>
  <div className="spec-controls">
   <label>Market sector<select aria-label="Comparison sector" value={sector} onChange={e=>{setSector(e.target.value);setSearch('')}}>{['All markets','Foreign exchange','Rates','Commodities','Equities','Crypto'].map(s=><option key={s}>{s}</option>)}</select></label>
   <label>Selected market<select aria-label="Comparison market" value={selected?.code||''} onChange={e=>setCode(e.target.value)} disabled={!markets.length}>{!markets.length&&<option value="">No markets available</option>}{markets.map(m=><option key={m.code} value={m.code}>{m.name}</option>)}</select></label>
   <label>Scanner percentile window<select aria-label="Comparison percentile window" value={lookback} onChange={e=>setLookback(e.target.value)}>{SPEC_WINDOWS.map(([w,n])=><option value={w} key={w}>{n}</option>)}</select></label>
   <button className="button" disabled={loading||refreshing} onClick={refresh}><RefreshCw size={14} className={refreshing?'spin':''}/> Refresh three lenses</button>
  </div>
  {status&&<div className="notice" role="status">{status}</div>}{error&&<div className="notice warning" role="alert">{error}<button className="text-button" onClick={refresh} disabled={refreshing}>Retry CFTC</button></div>}
  {loading?<div className="loading-state"><h2>Loading the three positioning views</h2><p>Matching contracts across TFF, Disaggregated and Legacy reports.</p></div>:!selected?<p className="empty">No markets in this universe. Select another sector or add a market to your watchlist.</p>:<>
   <section aria-label={`${selected.name} participant comparison`} className="spec-detail">
    <div className="spec-detail-heading"><div><span className="eyebrow">ONE MARKET · THREE LENSES</span><h2>{selected.name}</h2><p>{selected.code} · {basis==='FutOnly'?'Futures only':'Futures + options · delta equivalents'}</p></div><span className={`badge ${check.opposite.length?'spec-split':''}`}>{check.label}</span></div>
    {(!check.valid||check.opposite.length>0||check.rankSplit)&&<div className="spec-signal" role="note">{!check.valid?'Cross-lens flags are withheld until all relevant categories share the same report date and basis.':<>{check.opposite.length>0&&<span><b>Opposite net positions:</b> {check.opposite.join('; ')}.</span>}{check.rankSplit&&<span><b>Historical-rank gap:</b> {fmt(check.maxGap,1)} percentile points across the available lenses ({lookbackName}).</span>}</>}</div>}
    <div className="spec-lenses">{LENS_ORDER.map(key=>{const l=selected.lenses[key];return <article className={`spec-lens spec-lens-${key}`} key={key} aria-label={l?.label||NAMES[key]}>
     <div className="spec-lens-title"><span className="spec-line-key" style={{background:COLORS[key]}}/><h3>{l?.label||NAMES[key]}</h3></div><p className="spec-role">{ROLES[key]}</p>
     {!l?<p className="spec-unavailable">{key==='asset'&&selected.sector==='Commodities'?'Asset managers are not a category in the commodity report.':'No matching category is available.'}</p>:<>
      <div className="spec-net"><strong>{signed(l.net)}</strong><span>{l.net>0?'Net long':l.net<0?'Net short':'Net flat'} · contracts{basis==='Combined'?' equivalent':''}</span></div>
      <div className="spec-metrics"><div><span>Net / open interest</span><b>{signed(l.netoi,1)}%</b></div><div><span>Weekly net change</span><b>{signed(l.dNet)}</b></div></div>
      <div className="spec-ranks-label">Percentile of this category’s own net / OI</div><div className="spec-ranks">{SPEC_WINDOWS.map(([w,n])=><div key={w} className={lookback===w?'chosen':''}><span>{n}</span><Rank value={l.pct?.[w]}/></div>)}</div>
      <div className="spec-provenance"><span>Positions: {dateText(l.date)}</span><a href={`https://publicreporting.cftc.gov/resource/${l.dataset}.json?$where=cftc_contract_market_code%3D%27${encodeURIComponent(selected.code)}%27&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=2`} target="_blank" rel="noreferrer">CFTC source <ArrowUpRight size={11}/></a></div>
     </>}
    </article>})}</div>
    <p className="spec-footnote">Ranks are calculated separately from each category’s history. A low rank means relatively short; it can still be net long. Missing or insufficient history stays blank.</p>
   </section>
   <section className="panel" aria-label="Participant history chart"><div className="panel-head"><div><h2>How the three views evolved</h2><p>{selected.name} · one line per category · no categories are summed</p></div><div className="spec-chart-controls"><label>Measure<select aria-label="Comparison chart measure" value={metric} onChange={e=>setMetric(e.target.value)}><option value="netoi">Net / OI (%)</option><option value="net">Net contracts</option></select></label><label>History<select aria-label="Comparison chart history" value={range} onChange={e=>setRange(+e.target.value)}>{[[52,'1 year'],[156,'3 years'],[260,'5 years'],[520,'10 years'],[9999,'All retained']].map(([w,n])=><option key={w} value={w}>{n}</option>)}</select></label></div></div>
    {historyLoading&&<p className="panel-note" role="status">Loading aligned participant histories…</p>}{historyError&&<p className="panel-note amber" role="status">{historyError}</p>}
    {chartData.length?<div className="spec-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={chartData} margin={{top:12,right:22,left:0,bottom:8}}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={s=>s.slice(0,7)} minTickGap={60} tick={{fill:'var(--muted)',fontSize:10}}/><YAxis width={62} tickFormatter={v=>metric==='netoi'?`${v}%`:new Intl.NumberFormat('en-US',{notation:'compact'}).format(v)} tick={{fill:'var(--muted)',fontSize:10}}/><Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)'}} labelFormatter={s=>dateText(s)} formatter={(v,n)=>[signed(Number(v),metric==='netoi'?2:0)+(metric==='netoi'?'%':''),n]}/><ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={.6}/>{LENS_ORDER.filter(k=>selected.lenses[k]).map((k,i)=><Line key={k} dataKey={k} name={selected.lenses[k].label} stroke={COLORS[k]} strokeDasharray={i===1?'5 3':i===2?'2 3':undefined} strokeWidth={1.8} dot={false} connectNulls={false} isAnimationActive={false}/>)}<Legend wrapperStyle={{fontSize:11}}/></LineChart></ResponsiveContainer></div>:!historyLoading&&<p className="empty">History unavailable for the selected market.</p>}
   </section>
  </>}
  {!loading&&markets.length>0&&<section className="panel spec-scanner"><div className="panel-head"><div><h2>Where the readings disagree</h2><p>{flagged.length} / {markets.length} markets have opposite nets or a rank gap of at least 50 points. Click a market to inspect it above.</p></div><button className="button" onClick={()=>saveCSV(`CFTC-three-lenses-${basis}.csv`,comparisonExport(sorted,lookback))}><Download size={14}/> Export comparison CSV</button></div>
   <div className="table-toolbar"><label className="spec-toggle"><input type="checkbox" checked={onlySplit} onChange={e=>setOnlySplit(e.target.checked)}/> Show disagreements only</label><div className="search"><Search size={14}/><input aria-label="Search comparison markets" placeholder="Search market or code…" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
   <div className="table-wrap"><table className="spec-table"><thead><tr>{columns.map(([key,label])=><th key={key} aria-sort={sort.key===key?(sort.direction===1?'ascending':'descending'):'none'}><button onClick={()=>setSort({key,direction:sort.key===key?-sort.direction:key==='name'?1:-1})}>{label} {sort.key===key?(sort.direction===1?'↑':'↓'):'↕'}</button></th>)}</tr></thead><tbody>{sorted.slice((page-1)*50,page*50).map(row=>{const d=divergence(row,lookback);return <tr key={row.code} aria-selected={selected?.code===row.code}><td><button className="text-button" onClick={()=>{setCode(row.code);document.querySelector('.spec-detail')?.scrollIntoView({block:'start',behavior:'auto'})}}>{row.name}</button><small>{row.code} · {row.lenses.funds?.label||'Funds unavailable'}</small></td><td><span className={d.opposite.length?'spec-opposite':''}>{d.label}</span>{d.rankSplit&&<small>Rank gap ≥50 pp</small>}</td>{LENS_ORDER.flatMap(k=>[<td key={k+'net'}>{row.lenses[k]?signed(row.lenses[k].netoi,1)+'%':'—'}</td>,<td key={k+'rank'}><Rank value={row.lenses[k]?.pct?.[lookback]}/></td>])}<td>{d.maxGap==null?'—':fmt(d.maxGap,1)+' pp'}</td></tr>})}</tbody></table></div>
   {!sorted.length&&<p className="empty">No markets match these filters.</p>}<div className="table-footer"><span>{sorted.length?Math.min((page-1)*50+1,sorted.length):0}–{Math.min(page*50,sorted.length)} of {sorted.length} markets · {lookbackName} ranks</span><div><button className="button" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="button" disabled={page*50>=sorted.length} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
  </section>}
  <div className="bottom-notes"><p><b>Read the disagreement.</b> Opposite nets mean at least two available categories have opposite signs on the same date. The 50-point rank-gap flag is a descriptive threshold, not a trading signal. A missing category or mismatched date suppresses cross-lens flags.</p><p><b>Coverage and interpretation.</b> Commodities use managed money; financial contracts use leveraged funds. Legacy is an overlapping classification. Asset-manager positions may hedge portfolios; leveraged funds may hedge OTC risk. Nonreportables and other reportables are not automatically speculative money.</p></div>
 </div>
}
