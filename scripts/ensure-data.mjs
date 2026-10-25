import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {DATASETS} from '../lib/analytics.mjs';
if(Object.keys(DATASETS).some(id=>!fs.existsSync(`data/${id}.json.gz`))){
 const p=spawnSync('python3',['scripts/refresh.py'],{stdio:'inherit',timeout:600000});if(p.status!==0)process.exit(p.status||1);
}
