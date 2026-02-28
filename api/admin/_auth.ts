import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

export type AdminRequestContext = {
  client: SupabaseClient;
  user: User;
  roleKey: string;
  workspaceId: string | null;
  organizationId: string | null;
};

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const makeAdminClient = () => {
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

const readWorkspaceId = (req: RequestLike): string | null => {
  const header = req.headers?.['x-workspace-id'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !value.trim()) return null;
  return value.trim();
};

export async function requireAdmin(
  req: RequestLike,
  res: ResponseLike,
  requiredPermission: string
): Promise<AdminRequestContext | null> {
  let adminClient: SupabaseClient;

  try {
    adminClient = makeAdminClient();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Server configuration error.' });
    return null;
  }

  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token.' });
    return null;
  }

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Invalid auth token.' });
    return null;
  }

  const workspaceFromHeader = readWorkspaceId(req);
  if (workspaceFromHeader) {
    const { data: membership, error: membershipError } = await adminClient
      .from('workspace_memberships')
      .select('workspace_id, organization_id, role_key, is_active')
      .eq('workspace_id', workspaceFromHeader)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (!membershipError && membership && membership.is_active) {
      const { data: allowed, error: permissionError } = await adminClient.rpc('workspace_has_permission', {
        p_workspace_id: workspaceFromHeader,
        p_permission_key: requiredPermission,
        p_user_id: userData.user.id,
      });

      if (permissionError) {
        res.status(500).json({ error: 'Failed to verify workspace permissions.' });
        return null;
      }

      if (!allowed) {
        res.status(403).json({ error: `Permission denied: ${requiredPermission}` });
        return null;
      }

      return {
        client: adminClient,
        user: userData.user,
        roleKey: String(membership.role_key || 'support'),
        workspaceId: workspaceFromHeader,
        organizationId: membership.organization_id ? String(membership.organization_id) : null,
      };
    }
  }

  // Auto-pick first active workspace membership if header is missing.
  const { data: firstMembership, error: firstMembershipError } = await adminClient
    .from('workspace_memberships')
    .select('workspace_id, organization_id, role_key, is_active')
    .eq('user_id', userData.user.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstMembershipError && firstMembership?.workspace_id) {
    const workspaceId = String(firstMembership.workspace_id);
    const { data: allowed, error: permissionError } = await adminClient.rpc('workspace_has_permission', {
      p_workspace_id: workspaceId,
      p_permission_key: requiredPermission,
      p_user_id: userData.user.id,
    });

    if (permissionError) {
      res.status(500).json({ error: 'Failed to verify workspace permissions.' });
      return null;
    }

    if (!allowed) {
      res.status(403).json({ error: `Permission denied: ${requiredPermission}` });
      return null;
    }

    return {
      client: adminClient,
      user: userData.user,
      roleKey: String(firstMembership.role_key || 'support'),
      workspaceId,
      organizationId: firstMembership.organization_id ? String(firstMembership.organization_id) : null,
    };
  }

  // Legacy fallback: global admin_users role model.
  const { data: adminUser, error: adminError } = await adminClient
    .from('admin_users')
    .select('user_id, is_active, admin_roles(role_key)')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (adminError) {
    res.status(500).json({ error: 'Failed to verify admin access.' });
    return null;
  }

  const roleKey = (adminUser?.admin_roles as { role_key?: string } | null)?.role_key || '';

  if (!adminUser || !adminUser.is_active || !roleKey) {
    res.status(403).json({ error: 'Admin access denied.' });
    return null;
  }

  if (roleKey !== 'super_admin') {
    const { data: allowed, error: permError } = await adminClient.rpc('admin_has_permission', {
      p_permission_key: requiredPermission,
      p_user_id: userData.user.id,
    });

    if (permError) {
      res.status(500).json({ error: 'Failed to verify admin permissions.' });
      return null;
    }

    if (!allowed) {
      res.status(403).json({ error: `Permission denied: ${requiredPermission}` });
      return null;
    }
  }

  return {
    client: adminClient,
    user: userData.user,
    roleKey,
    workspaceId: null,
    organizationId: null,
  };
}
