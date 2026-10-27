// Worker entry: requests go through Astro; the daily Cron Trigger runs the scheduled jobs.
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { handle } from '@astrojs/cloudflare/handler';
import { runDailyJobs } from './lib/jobs';

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      fetch: (request: Request, env: Env, ctx: ExecutionContext) => handle(manifest, app, request as never, env, ctx),
      scheduled: (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
        ctx.waitUntil(runDailyJobs(env));
      },
    },
  };
}
