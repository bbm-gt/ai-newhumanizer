import { KVNamespace } from '@cloudflare/workers-types';

interface CloudflareEnv {
  AIHUMAN_KV: KVNamespace;
}

declare global {
  interface CloudflareEnvironment extends CloudflareEnv {}
}