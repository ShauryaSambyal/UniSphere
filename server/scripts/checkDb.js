
import dns from 'dns/promises';
import net from 'net';
import tls from 'tls';
import '../config/env.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Add it to server/.env (or the repo-root .env).');
  process.exit(1);
}

const masked = uri.replace(/\/\/([^:]+):([^@]+)@/, (_, user) => `//${user}:••••••••@`);
const user = uri.match(/\/\/([^:]+):/)?.[1] ?? '(none)';
const clusterHost = uri.match(/@([^/?]+)/)?.[1] ?? '';
const isSrv = uri.startsWith('mongodb+srv://');
const timeoutMs = Number(process.env.DB_CHECK_TIMEOUT_MS || 8000);

console.log('MongoDB connectivity check');
console.log('  uri       :', masked);
console.log('  user      :', user);
console.log('  mode      :', isSrv ? 'SRV (mongodb+srv)' : 'direct (mongodb)');
console.log('  timeout   :', timeoutMs + 'ms per stage\n');

const withTimeout = (promise, ms, label) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: 'ETIMEDOUT' })), ms))]);

const verdicts = [];
const record = (stage, ok, detail) => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${stage.padEnd(26)} ${detail}`);
  verdicts.push({ stage, ok, detail });
};

function tcpProbe(host, port) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.connect({ host, port });
    const finish = (ok, detail) => { socket.destroy(); resolve({ ok, detail: `${detail} (${Date.now() - started}ms)` }); };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true, 'connected'));
    socket.once('timeout', () => finish(false, 'ETIMEDOUT'));
    socket.once('error', (err) => finish(false, `${err.code}: ${err.message}`));
  });
}

function tlsProbe(host, port) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = tls.connect({ host, port, servername: host });
    const finish = (ok, detail) => { socket.destroy(); resolve({ ok, detail: `${detail} (${Date.now() - started}ms)` }); };
    socket.setTimeout(timeoutMs);
    socket.once('secureConnect', () => finish(true, `handshake ok, peer CN ${socket.getPeerCertificate()?.subject?.CN ?? 'n/a'}`));
    socket.once('timeout', () => finish(false, 'ETIMEDOUT — TLS payload dropped/blocked'));
    socket.once('error', (err) => finish(false, `${err.code}: ${err.message}`));
  });
}

console.log('[1/4] DNS');
let shardTargets = [];
try {
  if (isSrv) {
    const srv = await withTimeout(dns.resolveSrv(`_mongodb._tcp.${clusterHost}`), timeoutMs, 'SRV lookup');
    shardTargets = srv.map((s) => ({ host: s.name, port: s.port }));
    record('SRV lookup', true, `${srv.length} shard(s): ${srv.map((s) => s.name).join(', ')}`);
  } else {
    shardTargets = [{ host: clusterHost, port: Number(uri.match(/:(\d+)\//)?.[1] ?? 27017) }];
    record('host', true, `${clusterHost}:${shardTargets[0].port}`);
  }
} catch (err) {
  record('SRV lookup', false, `${err.code ?? err.name}: ${err.message}`);
}

if (shardTargets.length > 0) {
  const { host, port } = shardTargets[0];

  console.log('\n[2/4] TCP to', `${host}:${port}`);
  const tcp = await tcpProbe(host, port);
  record('tcp connect', tcp.ok, tcp.detail);

  console.log('\n[3/4] TLS');
  const tls = await tlsProbe(host, port);
  record('tls handshake', tls.ok, tls.detail);
}

console.log('\n[4/4] driver handshake (this is what Mongoose does)');
let connected = false;
let serverErrors = [];
try {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: timeoutMs, connectTimeoutMS: timeoutMs });
  const failures = new Map();
  client.on('serverHeartbeatFailed', (event) => {
    const key = `${event.serverAddress} :: ${event.failure?.name}: ${event.failure?.message}`;
    failures.set(key, true);
  });
  try {
    await client.connect();
    connected = true;
    const hello = await client.db().admin().command({ hello: 1 });
    record('driver handshake', true, `setName=${hello.setName} primary=${hello.primary} msg=${hello.msg}`);
    const cols = await client.db().listCollections().toArray();
    record('list collections', true, cols.length ? cols.map((c) => c.name).join(', ') : '(empty database)');
  } catch (err) {
    serverErrors = [...failures.keys()];
    record('driver handshake', false, err.name);
  } finally {
    await client.close().catch(() => {});
  }
} catch (err) {
  record('driver handshake', false, `could not load driver: ${err.message}`);
}

if (serverErrors.length) {
  console.log('\n  actual per-server errors:');
  for (const line of serverErrors) console.log('   -', line.slice(0, 200));
}

console.log('\n' + '─'.repeat(72));
if (connected) {
  console.log('RESULT: connected — the connection string works.');
} else {
  const tcpStage = verdicts.find((v) => v.stage === 'tcp connect');
  const tlsStage = verdicts.find((v) => v.stage === 'tls handshake');
  const joined = serverErrors.join(' ').toLowerCase();

  console.log('RESULT: could not connect. Most likely cause:');
  if (!tcpStage?.ok) {
    console.log('  The TCP connection itself failed. Something between this machine and Atlas');
    console.log('  is blocking outbound port 27017 — a corporate/campus firewall, VPN, or');
    console.log('  antivirus "web shield". Try a different network (e.g. a phone hotspot) to confirm.');
  } else if (tlsStage && !tlsStage.ok) {
    console.log('  TCP connects but the TLS handshake fails. Same suspects as above: a firewall,');
    console.log('  VPN, or antivirus performing TLS inspection on non-HTTP ports.');
  } else if (joined.includes('authentication failed') || joined.includes('bad auth')) {
    console.log('  Credentials were rejected. The username/password in MONGODB_URI is wrong.');
    console.log('  Reset it in Atlas: Database Access -> Edit user -> Edit password, then paste the');
    console.log('  new string from Connect -> Drivers (the password must be URL-encoded if it has');
    console.log('  characters like @ : / ? # % and).');
  } else if (joined.includes('whitelist')) {
    console.log('  Atlas rejected this IP. Confirm the 0.0.0.0/0 entry is in the SAME project as');
    console.log('  this cluster and that it shows as Active in Network Access.');
  } else if (joined.includes('not authorized')) {
    console.log('  Authenticated, but the user lacks access to the database in the URI.');
  } else if (joined.includes('timed out') || joined.includes('etimedout')) {
    console.log('  The handshake never completed — the connection is being blackholed. Check for a');
    console.log('  firewall, VPN, or antivirus blocking outbound port 27017.');
  } else {
    console.log('  Server selection timed out without a specific server error, which usually means the');
    console.log('  cluster is paused or still resuming. Open Atlas and confirm the cluster state is');
    console.log('  "Active" (a free M0 cluster is paused automatically after long inactivity).');
  }
  console.log('\n  Checklist:');
  console.log('   1. Atlas -> Clusters: is the cluster Active (not Paused/Resuming)?');
  console.log('   2. Atlas -> Network Access: does 0.0.0.0/0 exist, in THIS project, and say Active?');
  console.log('   3. Atlas -> Database Access: does this username exist with this exact password?');
  console.log('   4. Re-copy the string from Connect -> Drivers to rule out a stale hostname.');
  console.log('   5. Try a different internet connection to rule out a local firewall/VPN.');
}
console.log('─'.repeat(72));

process.exit(connected ? 0 : 1);
