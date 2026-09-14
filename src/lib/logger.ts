export const logger = {
  info: (msg: string, ctx?: object) =>
    console.log(JSON.stringify({ level: 'info', msg, ...ctx, ts: Date.now() })),
  warn: (msg: string, ctx?: object) =>
    console.log(JSON.stringify({ level: 'warn', msg, ...ctx, ts: Date.now() })),
  error: (msg: string, ctx?: object) =>
    console.error(JSON.stringify({ level: 'error', msg, ...ctx, ts: Date.now() })),
};
