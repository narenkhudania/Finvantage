import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

type RequestLike = {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const normalizeIdentifier = (value: unknown) => String(value || '').trim().toLowerCase();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 40;
const requestRateMap = new Map<string, { count: number; startedAt: number }>();

const readHeader = (
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string
) => {
  const value = headers?.[key] ?? headers?.[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const getClientKey = (req: RequestLike) => {
  const forwarded = String(readHeader(req.headers, 'x-forwarded-for') || '').trim();
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip;
  }
  const realIp = String(readHeader(req.headers, 'x-real-ip') || '').trim();
  return realIp || 'unknown';
};

const buildRateLimitIdentityHash = (req: RequestLike) => {
  const ip = getClientKey(req);
  const ua = String(readHeader(req.headers, 'user-agent') || '').trim().toLowerCase();
  const deviceHeader = String(readHeader(req.headers, 'x-device-fingerprint') || '').trim().toLowerCase();
  return crypto
    .createHash('sha256')
    .update(`${ip}|${ua}|${deviceHeader}`)
    .digest('hex');
};

const isRateLimited = (clientKey: string) => {
  const now = Date.now();
  const current = requestRateMap.get(clientKey);
  if (!current || now - current.startedAt > RATE_LIMIT_WINDOW_MS) {
    requestRateMap.set(clientKey, { count: 1, startedAt: now });
    return false;
  }
  current.count += 1;
  requestRateMap.set(clientKey, current);
  return current.count > RATE_LIMIT_MAX_REQUESTS;
};

const cleanupRateMap = () => {
  const now = Date.now();
  for (const [key, value] of requestRateMap.entries()) {
    if (now - value.startedAt > RATE_LIMIT_WINDOW_MS * 2) {
      requestRateMap.delete(key);
    }
  }
};

const delay = async (ms: number) => {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
};

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

const buildSupabaseClient = () => {
  if (!supabaseUrl) return null;
  const key = supabaseServiceKey || supabaseAnonKey;
  if (!key) return null;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const findIdentifierExists = async (identifier: string) => {
  const client = buildSupabaseClient();
  if (!client || !identifier || !identifier.includes('@')) return false;

  const { data: rpcData, error: rpcError } = await client.rpc('identifier_exists', { p_identifier: identifier });
  if (!rpcError && typeof rpcData === 'boolean') {
    return rpcData;
  }

  if (supabaseServiceKey) {
    const { count, error } = await client
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
      .ilike('identifier', identifier)
      .limit(1);
    if (!error) return Number(count || 0) > 0;
  }

  return false;
};

const isRateLimitedServerSide = async (req: RequestLike) => {
  const client = buildSupabaseClient();
  if (!client) return null;
  const identityHash = buildRateLimitIdentityHash(req);
  const { data, error } = await client.rpc('rate_limit_allow', {
    p_scope: 'auth.check_identifier',
    p_identity_hash: identityHash,
    p_window_seconds: 10 * 60,
    p_max_requests: RATE_LIMIT_MAX_REQUESTS,
  });
  if (error) {
    const text = String(error.message || '').toLowerCase();
    if (text.includes('does not exist') || text.includes('function')) return null;
    throw error;
  }
  const allowed = Boolean((data as any)?.allowed);
  return !allowed;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  cleanupRateMap();
  const clientKey = getClientKey(req);
  const localRateLimited = isRateLimited(clientKey);
  let serverRateLimited = false;
  try {
    const remote = await isRateLimitedServerSide(req);
    serverRateLimited = remote === true;
  } catch {
    serverRateLimited = false;
  }
  if (localRateLimited || serverRateLimited) {
    res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    return;
  }

  const identifier = normalizeIdentifier(req.body?.identifier);
  const hasEmailShape = Boolean(identifier && identifier.includes('@'));

  try {
    // Uniform response delay keeps response timing stable enough for UX and abuse control.
    await delay(160);
    const exists = hasEmailShape ? await findIdentifierExists(identifier) : false;

    res.status(200).json({
      data: {
        accepted: hasEmailShape,
        exists,
        useLoginFirst: exists,
      },
    });
  } catch (err) {
    res.status(200).json({
      data: {
        accepted: hasEmailShape,
        exists: false,
        useLoginFirst: true,
      },
    });
  }
}
