import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {ingestionJobs} from './meta-format-contract.mjs';
for (const job of ingestionJobs('online')) {
  execFileSync(process.execPath,[fileURLToPath(new URL('./build-current-field.mjs',import.meta.url))],{
    stdio:'inherit',env:{...process.env,META_INGEST_FORMAT:job.format},
  });
}
