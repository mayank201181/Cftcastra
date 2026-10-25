import {spawn} from 'node:child_process';
const args=process.argv.slice(2),pi=args.indexOf('--port'),port=pi>=0?args[pi+1]:'4173';
const p=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','0.0.0.0','--port',port],{stdio:'inherit'});p.on('exit',c=>process.exit(c||0));
