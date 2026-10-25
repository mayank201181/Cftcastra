"""Semantic fixtures and archive reconciliation. No network required."""
import importlib.util,json,gzip,pathlib,sys,datetime as dt
p=pathlib.Path(__file__).with_name('refresh-research.py');spec=importlib.util.spec_from_file_location('feeds',p);feeds=importlib.util.module_from_spec(spec);spec.loader.exec_module(feeds)
def row(strike,oi,joined=False):
    return f'{strike} ---- ---- ---- ---- .001000 +0.000100 .500 ---- ---- {oi} UNCH '+('36.982500.000500' if joined else '.003000 .000500')
fixture='PRELIMINARY\n'
for side in ['CALL','PUT']:
    fixture+=f'ADDITIONAL AUSSIE & NEW ZEALAND {side} Options\n'
    for month in ['NOV26','DEC26']:
        fixture+=f'{month} ADU OPT (FUTURES SETT. .00)\n'+row(7000,23,True)+'\n'+row(7100,17)+'\nTOTAL 0 40\n'
parsed=feeds.parse_aud_strikes(fixture,'2026-10-23','https://www.cmegroup.com/test.pdf','test')
assert len(parsed)==4 and all(r['totalOi']==40 for r in parsed)
assert feeds.parse_macro_oi('ES E-MINI S&P 500 FUTURES 1786511 7380 1793891 1967655 + 7525 1281236 1903719',{'symbol':'ES','expected':'E-MINI S&P 500 FUTURES'})==(1967655,7525)
assert feeds.parse_macro_oi('CL NYMEX CRUDE OIL (PHYSICAL) 1000139 28398 1028537 1914007 - 16048 1089397 1881011',{'symbol':'CL','expected':'NYMEX CRUDE OIL (PHYSICAL)'})==(1914007,-16048)
try:feeds.parse_aud_strikes(fixture.replace('TOTAL 0 40','TOTAL 0 41',1),'2026-10-23','test','test');raise AssertionError('Bad total accepted')
except ValueError:pass
if '--archive' in sys.argv:
    data=feeds.read_json(feeds.DATA/'research-inputs.json',{});prices=feeds.read_json(feeds.DATA/'research-prices.json.gz',{})
    assert len(data['ice'])>1000 and len(data['ttf'])>100 and len(data['jpx'])>=5 and len(data['cme'])>=10
    for r in data['ice']+data['ttf']:
        assert abs(r['long']-r['short']-r['net'])<1e-4 and r['oi']>0
        assert abs(100*r['net']/r['oi']-r['netoi'])<1e-6
    for r in data['jpx']:
        for g in r['groups']:assert abs(g['buyBn']-g['sellBn']-g['netBn'])<1e-6
    for r in data.get('strikes',[]):assert sum(s['oi'] for s in r['strikes'])==r['totalOi']
    for r in data.get('cme_macro',[]):assert r['oi']>0 and r['oi']-r['change']>0 and r['scope'] and r['sourceSha256']
    for m in prices['markets'].values():
        h=m['history'];assert h and all(p[1]>0 for p in h) and h==sorted(h)
        assert len(set(p[0] for p in h))==len(h) and h[-1][0]==m['asof']
        if m['sector']=='Foreign exchange':assert all(dt.date.fromisoformat(p[0]).weekday()<5 for p in h)
print('Research feed checks passed: strike totals, source arithmetic, JPX balances, date order and price conventions.')
