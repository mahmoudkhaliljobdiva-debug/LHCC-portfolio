// Opt-in NODE_OPTIONS=--import=./scripts/local-fetch-metrics.mjs for LOCAL QA only.
// Never logs headers, query parameters, credentials or response bodies.
import { appendFileSync, mkdirSync } from 'node:fs';
const original = globalThis.fetch;
globalThis.fetch = async (...args) => {
 const input=args[0];const url=new URL(typeof input==='string'?input:input.url??String(input));
 if(!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='55431')return original(...args);
 const start=performance.now();const response=await original(...args);
 mkdirSync('.test-artifacts',{recursive:true});
 appendFileSync('.test-artifacts/fetch-metrics.jsonl',JSON.stringify({time:Date.now(),path:url.pathname,ms:performance.now()-start,status:response.status})+'\n');
 return response;
};
