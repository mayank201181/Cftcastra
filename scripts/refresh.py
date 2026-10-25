"""Official CFTC archive refresh. Standard library only; deterministic gzip; no credentials.
Run on GitHub Actions or locally. A first run fetches full current-universe history;
subsequent unchanged releases leave files unchanged. Annual full history is refetched
on a new report to retain revisions. Raw vintage files remain in Git commit history.
"""
import concurrent.futures, datetime as dt, gzip, json, os, pathlib, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
FAMILIES = json.loads((DATA / 'field-mappings.json').read_text())
BASE = ['report_date_as_yyyy_mm_dd','cftc_contract_market_code','open_interest_all']
EXTRA = ['tot_rept_positions_long_all','tot_rept_positions_short','traders_tot_all','conc_gross_le_4_tdr_long','conc_gross_le_4_tdr_short','conc_gross_le_8_tdr_long','conc_gross_le_8_tdr_short','conc_net_le_4_tdr_long_all','conc_net_le_4_tdr_short_all','conc_net_le_8_tdr_long_all','conc_net_le_8_tdr_short_all']

def get(url, timeout=90):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'CFTC-Astra/1.0 (public data research)','Accept':'application/json'})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return json.load(response)
        except Exception:
            if attempt == 3: raise
            time.sleep(1 + attempt)

def query(dataset, params):
    return get('https://publicreporting.cftc.gov/resource/'+dataset+'.json?'+urllib.parse.urlencode(params))

def refresh(job):
    family,dataset,basis=job
    target=DATA/(dataset+'.json.gz')
    latest=query(dataset,{'$select':'max(report_date_as_yyyy_mm_dd) as latest'})[0]['latest'][:10]
    if target.exists() and not os.getenv('CFTC_FORCE_REFRESH'):
        old=json.loads(gzip.decompress(target.read_bytes()))
        if max(r[0] for r in old['rows'])==latest:
            print(dataset,latest,'unchanged',flush=True)
            return latest
    catalog=query(dataset,{'$where':f"report_date_as_yyyy_mm_dd='{latest}T00:00:00' AND futonly_or_combined='{basis}'",'$select':'cftc_contract_market_code,market_and_exchange_names,contract_units,commodity_group_name,commodity_subgroup_name,futonly_or_combined','$limit':5000})
    if not catalog or any(r['futonly_or_combined']!=basis for r in catalog): raise ValueError('Invalid catalog or basis')
    codes=sorted(set(r['cftc_contract_market_code'] for r in catalog))
    groups=FAMILIES[family]['groups']
    fields=BASE+list(dict.fromkeys(k for g in groups.values() for k in g if k))+EXTRA
    where="report_date_as_yyyy_mm_dd >= '2006-01-01T00:00:00' AND futonly_or_combined='"+basis+"' AND cftc_contract_market_code in ("+','.join("'"+c+"'" for c in codes)+")"
    rows=[];offset=0
    while True:
        page=query(dataset,{'$select':','.join(fields),'$where':where,'$order':','.join(BASE[:2]),'$limit':50000,'$offset':offset})
        if not isinstance(page,list):raise ValueError('Non-table CFTC response')
        for raw in page:
            row=[]
            for k in fields:
                v=raw.get(k)
                if k==BASE[0]:v=v[:10]
                elif k!=BASE[1] and v is not None:
                    try:
                        v=float(v);v=int(v) if v.is_integer() else v
                    except (TypeError,ValueError):v=None
                row.append(v)
            rows.append(row)
        print(dataset,'downloaded',len(rows),flush=True)
        if len(page)<50000:break
        offset+=len(page)
    keys={(r[0],r[1]) for r in rows}
    if len(keys)!=len(rows) or max(r[0] for r in rows)!=latest:raise ValueError('Duplicate or missing latest records')
    for row in rows:
        raw=dict(zip(fields,row));oi=raw['open_interest_all']
        if oi<0:raise ValueError('Negative OI')
        for side in (0,1):
            total=0
            for f in groups.values():
                v=raw.get(f[side]);sp=raw.get(f[2],0) if f[2] else 0
                if v is None:raise ValueError('Missing position')
                if v<0 or (sp is not None and sp<0):raise ValueError('Negative position')
                total+=v+(sp or 0)
            if abs(total-oi)>5:raise ValueError('Open interest accounting failure')
    payload={'dataset':dataset,'family':family,'basis':basis,'source':f'https://publicreporting.cftc.gov/resource/{dataset}.json','retrieved_at':dt.datetime.now(dt.timezone.utc).isoformat(),'current_codes':codes,'history_start':'2006-01-01','fields':fields,'groups':groups,'catalog':catalog,'rows':rows}
    tmp=target.with_suffix('.tmp');tmp.write_bytes(gzip.compress(json.dumps(payload,separators=(',',':')).encode(),mtime=0));tmp.replace(target)
    return latest

def refresh_prices(cutoff):
    file=DATA/'prices.json';prices=json.loads(file.read_text()) if file.exists() else {}
    symbols='EURUSD=X JPY=X AUDUSD=X GBPUSD=X CAD=X CHF=X NZDUSD=X MXN=X BRL=X ZAR=X ES=F NQ=F YM=F RTY=F CL=F NG=F GC=F SI=F HG=F ZC=F ZW=F ZS=F KC=F CT=F SB=F CC=F HE=F LE=F GF=F RB=F HO=F PL=F PA=F ZL=F ZM=F OJ=F BTC=F ETH=F DX-Y.NYB'.split()
    end=dt.datetime.fromisoformat(cutoff).replace(tzinfo=dt.timezone.utc)+dt.timedelta(days=1)
    params={'period1':int((end-dt.timedelta(days=20)).timestamp()),'period2':int(end.timestamp()),'interval':'1d'}
    def one(symbol):
        if prices.get(symbol,{}).get('date')==cutoff:return None
        url='https://query2.finance.yahoo.com/v8/finance/chart/'+urllib.parse.quote(symbol,safe='')+'?'+urllib.parse.urlencode(params)
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req,timeout=25) as response:r=json.load(response)['chart']['result'][0]
            pairs=[(dt.datetime.fromtimestamp(t,dt.timezone.utc).date().isoformat(),v) for t,v in zip(r['timestamp'],r['indicators']['quote'][0]['close']) if v is not None]
            valid=[p for p in pairs if p[0]<=cutoff]
            if not valid:return None
            d,v=max(valid)
            return symbol,{'price':v,'date':d,'source':'Yahoo Finance · daily close','source_url':url,'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat()}
        except Exception as exc:
            print('PRICE UNAVAILABLE',symbol,str(exc),flush=True);return None
    changed=False
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(one,symbols):
            if result:prices[result[0]]=result[1];changed=True
    if changed:file.write_text(json.dumps(prices,separators=(',',':')))

if __name__=='__main__':
    jobs=[(f,d,'FutOnly' if i==0 else 'Combined') for f,m in FAMILIES.items() for i,d in enumerate(m['datasets'])]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        dates=list(pool.map(refresh,jobs))
    refresh_prices(min(dates))
    print('CFTC refresh validated; latest dates:',dates,flush=True)
