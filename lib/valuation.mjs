// Vetted present-day contract sizes. Historical charts remain in contracts / OI shares.
// Futures-price proxies are applied to all expiries and are indicative, not exact marks.
export const SPECS={
 '099741':['EURUSD=X',125000,1],'299741':['EURUSD=X',125000,1],'399741':['EURUSD=X',125000,1],
 '097741':['JPY=X',12500000,-1],'096742':['GBPUSD=X',62500,1],'232741':['AUDUSD=X',100000,1],'112741':['NZDUSD=X',100000,1],'090741':['CAD=X',100000,-1],'092741':['CHF=X',125000,-1],'095741':['MXN=X',500000,-1],'102741':['BRL=X',100000,-1],'122741':['ZAR=X',500000,-1],
 '098662':['DX-Y.NYB',1000,1],'1170E1':['VX=F',1000,1],
 '244041':['MFS=F',50,1],'244042':['MME=F',50,1],
 '13874+':['ES=F',50,1],'13874A':['ES=F',50,1],'13874U':['ES=F',5,1],
 '20974+':['NQ=F',20,1],'209742':['NQ=F',20,1],'209747':['NQ=F',2,1],
 '12460+':['YM=F',5,1],'124603':['YM=F',5,1],'124608':['YM=F',.5,1],
 '239742':['RTY=F',50,1],'239747':['RTY=F',5,1],
 '133741':['BTC=F',5,1],'133742':['BTC=F',.1,1],'146021':['ETH=F',50,1],'146022':['ETH=F',.1,1],
 '067651':['CL=F',1000,1],'06765A':['CL=F',1000,1],'067411':['CL=F',1000,1],'06765T':['BZ=F',1000,1],
 '023651':['NG=F',10000,1],'111659':['RB=F',42000,1],'022651':['HO=F',42000,1],
 '088691':['GC=F',100,1],'088695':['GC=F',10,1],'084691':['SI=F',5000,1],'084694':['SI=F',1000,1],'085692':['HG=F',25000,1],
 '076651':['PL=F',50,1],'075651':['PA=F',100,1],
 '002602':['ZC=F',50,1],'001602':['ZW=F',50,1],'001612':['KE=F',50,1],'005602':['ZS=F',50,1],'005603':['ZS=F',10,1],
 '007601':['ZL=F',600,1],'026603':['ZM=F',100,1],'083731':['KC=F',375,1],'080732':['SB=F',1120,1],
 '073732':['CC=F',10,1],'033661':['CT=F',500,1],'054642':['HE=F',400,1],'057642':['LE=F',400,1],'061641':['GF=F',500,1],'040701':['OJ=F',150,1]
};
export const FACE={'042601':200000,'044601':100000,'043602':100000,'043607':100000,'020601':100000,'020604':100000,'045601':5000000,'134741':1000000,'134742':5000000,'134FM1':1000000,'342603':100000,'343603':100000,'344605':100000,'344606':100000,'344607':100000};
export function valuation(code,prices,asof){
 if(code==='240743'){const q=prices['NIY=F'],fx=prices['JPY=X'];if(!q||!fx||q.date>asof||fx.date>asof)return null;return {usdPerContract:q.price*500/fx.price,kind:'JPY Nikkei futures + FX proxy',date:[q.date,fx.date].sort()[0],price:q.price,symbol:'NIY=F',source:q.source,source_url:q.source_url,fxSource:fx.source_url,proxy:true,multiplier:500};}
 if(FACE[code])return {usdPerContract:FACE[code],kind:['042601','044601','043602','043607','020601','020604'].includes(code)?'Treasury face value':'Reference principal',date:asof,source:'CFTC contract units / exchange specifications',source_url:'https://www.cmegroup.com/markets/interest-rates.html',proxy:false};
 const s=SPECS[code];if(!s)return null;const q=prices[s[0]];if(!q||!(q.price>0)||q.date>asof)return null;
 return {usdPerContract:s[1]*(s[2]===-1?1/q.price:q.price),kind:q.kind||(s[0].endsWith('=X')?'FX spot proxy':'Front futures / index proxy'),date:q.date,price:q.price,symbol:s[0],source:q.source||'Yahoo Finance',source_url:q.source_url,proxy:true,multiplier:s[1],inverse:s[2]===-1};
}
