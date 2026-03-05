import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

export type BillingRequestContext = {
  client: SupabaseClient;
  user: User;
};

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const makeClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const readBearerToken = (req: RequestLike): string => {
  const authorizationHeader = req.headers?.authorization;
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!header) return '';
  const [scheme, token] = header.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return '';
  return token.trim();
};

export const withBillingAuth = async (
  req: RequestLike,
  res: { status: (code: number) => { json: (payload: unknown) => void } }
): Promise<BillingRequestContext | null> => {
  let client: SupabaseClient;
  try {
    client = makeClient();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Server misconfiguration.' });
    return null;
  }

  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token.' });
    return null;
  }

  let data: { user: User | null } | null = null;
  let error: { message?: string } | null = null;
  try {
    const result = await client.auth.getUser(token);
    data = result.data;
    error = result.error;
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Could not validate auth token.' });
    return null;
  }
  if (error || !data?.user) {
    res.status(401).json({ error: 'Invalid auth token.' });
    return null;
  }

  return { client, user: data.user };
};
