/* ─── AppDB: Supabase 기반 데이터 레이어 (정리본) ─── */
(function () {
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(n) {
    return Number(n || 0).toLocaleString('ko-KR') + '원';
  }

  const USER_KEY = 'vaultboard_supabase_user';

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function setCurrentUser(profile) {
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
  }

  function clearCurrentUser() {
    localStorage.removeItem(USER_KEY);
  }

  function sb() {
    return window.supabaseClient;
  }

  async function fetchMyProfile(userId) {
    const client = sb();
    const { data, error } = await client
      .from('profiles')
      .select('id, username, display_name, role, status, created_at, approved_at')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      username: data.username,
      display_name: data.display_name,
      displayName: data.display_name,
      role: data.role,
      status: data.status,
      created_at: data.created_at,
      createdAt: data.created_at,
      approved_at: data.approved_at,
      approvedAt: data.approved_at
    };
  }

  /* ───────────────── AUTH ───────────────── */

  async function signup({ email, password, displayName, username }) {
    const client = sb();
    if (!client) return { ok: false, error: 'Supabase 클라이언트가 준비되지 않았습니다.' };

    const { data: authData, error: authError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || username || email,
          username: username || email
        }
      }
    });

    if (authError) {
      return { ok: false, error: authError.message };
    }

    if (!authData?.user) {
      return { ok: false, error: '계정 생성에 실패했습니다.' };
    }

    // profiles/categories는 DB 트리거가 생성
    // 트리거 반영 시간을 고려해 짧게 재시도
    let profile = null;
    for (let i = 0; i < 5; i++) {
      profile = await fetchMyProfile(authData.user.id);
      if (profile) break;
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    if (!profile) {
      profile = {
        id: authData.user.id,
        username: username || email,
        display_name: displayName || username || email,
        displayName: displayName || username || email,
        role: 'user',
        status: 'trial'
      };
    }

    setCurrentUser(profile);
    return { ok: true, user: profile };
  }

  async function login({ email, password }) {
    const client = sb();
    if (!client) return { ok: false, error: 'Supabase 클라이언트가 준비되지 않았습니다.' };

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    if (!data?.user) return { ok: false, error: '사용자 정보를 찾을 수 없습니다.' };

    const profile = await fetchMyProfile(data.user.id);
    if (!profile) return { ok: false, error: '프로필 조회 실패' };

    if (profile.status === 'disabled') {
      await client.auth.signOut();
      return { ok: false, error: '비활성화된 계정입니다.' };
    }

    setCurrentUser(profile);
    return { ok: true, user: profile };
  }

  async function logout() {
    clearCurrentUser();
    if (sb()) {
      await sb().auth.signOut().catch(() => {});
    }
  }

  /* ───────────────── ACCOUNT ───────────────── */

  async function updateOwnAccount(userId, payload) {
    const client = sb();
    if (!client) return { ok: false, error: 'Supabase 클라이언트가 준비되지 않았습니다.' };

    const update = {};
    if (payload.displayName !== undefined) update.display_name = payload.displayName;

    if (Object.keys(update).length > 0) {
      const { error } = await client
        .from('profiles')
        .update(update)
        .eq('id', userId);

      if (error) return { ok: false, error: error.message };
    }

    if (payload.password) {
      const { error } = await client.auth.updateUser({ password: payload.password });
      if (error) return { ok: false, error: error.message };
    }

    const refreshed = await fetchMyProfile(userId);
    if (refreshed) setCurrentUser(refreshed);

    return { ok: true };
  }

  async function deleteOwnAccount(userId) {
    const client = sb();
    if (!client) return { ok: false, error: 'Supabase 클라이언트가 준비되지 않았습니다.' };

    await client.from('services').delete().eq('owner_id', userId);
    await client.from('categories').delete().eq('owner_id', userId);
    await client.from('profiles').delete().eq('id', userId);

    clearCurrentUser();
    await client.auth.signOut().catch(() => {});
    return { ok: true };
  }

  /* ───────────────── ADMIN ───────────────── */

  async function loadDB() {
    const client = sb();
    if (!client) {
      return { settings: { maxActiveUsers: 10 }, users: [] };
    }

    const [settingsRes, usersRes] = await Promise.all([
      client.from('app_settings').select('id, max_active_users').order('id', { ascending: true }).limit(1).maybeSingle(),
      client.from('profiles').select('id, username, display_name, role, status, created_at, approved_at').order('created_at', { ascending: true })
    ]);

    const settings = settingsRes.data || { id: 1, max_active_users: 10 };
    const users = (usersRes.data || []).map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      status: u.status,
      createdAt: u.created_at,
      approvedAt: u.approved_at
    }));

    return {
      settings: {
        id: settings.id,
        maxActiveUsers: settings.max_active_users ?? 10
      },
      users
    };
  }

  async function adminApproveUser(userId) {
    const client = sb();
    const db = await loadDB();

    const activeCount = db.users.filter(u => u.role !== 'admin' && u.status === 'active').length;
    if (activeCount >= db.settings.maxActiveUsers) {
      return { ok: false, error: '승인 가능한 활성 사용자 수를 초과했습니다.' };
    }

    const { error } = await client
      .from('profiles')
      .update({ status: 'active', approved_at: new Date().toISOString() })
      .eq('id', userId)
      .neq('role', 'admin');

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function adminRestoreTrial(userId) {
    const { error } = await sb()
      .from('profiles')
      .update({ status: 'trial', approved_at: null })
      .eq('id', userId)
      .neq('role', 'admin');

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function adminDisableUser(userId) {
    const { error } = await sb()
      .from('profiles')
      .update({ status: 'disabled' })
      .eq('id', userId)
      .neq('role', 'admin');

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function adminDeleteUser(userId) {
    const client = sb();
    await client.from('services').delete().eq('owner_id', userId);
    await client.from('categories').delete().eq('owner_id', userId);

    const { error } = await client
      .from('profiles')
      .delete()
      .eq('id', userId);

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function adminSetMaxActiveUsers(max) {
    const client = sb();
    const db = await loadDB();

    const { error } = await client
      .from('app_settings')
      .update({ max_active_users: Math.max(0, Number(max || 0)) })
      .eq('id', db.settings.id);

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function getUserById(userId) {
    const { data, error } = await sb()
      .from('profiles')
      .select('id, username, display_name, role, status')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      display_name: data.display_name,
      role: data.role,
      status: data.status
    };
  }

  /* ───────────────── CATEGORIES ───────────────── */

  async function userCategories(ownerId) {
    const { data, error } = await sb()
      .from('categories')
      .select('*')
      .eq('owner_id', ownerId)
      .order('sort_order', { ascending: true });

    if (error) return [];

    return data.map(c => ({
      id: c.id,
      ownerId: c.owner_id,
      name: c.name,
      order: c.sort_order
    }));
  }

  async function addCategory(ownerId, name) {
    const cats = await userCategories(ownerId);
    const nextOrder = cats.reduce((m, c) => Math.max(m, c.order), 0) + 1;

    const { error } = await sb()
      .from('categories')
      .insert({ owner_id: ownerId, name, sort_order: nextOrder });

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function updateCategory(catId, name) {
    const { error } = await sb()
      .from('categories')
      .update({ name })
      .eq('id', catId);

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function deleteCategory(catId) {
    const client = sb();

    const { data: cat } = await client
      .from('categories')
      .select('owner_id')
      .eq('id', catId)
      .single();

    if (!cat) return { ok: false, error: '카테고리를 찾을 수 없습니다.' };

    const ownerId = cat.owner_id;

    let { data: etc } = await client
      .from('categories')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('name', 'ETC')
      .maybeSingle();

    if (!etc) {
      const cats = await userCategories(ownerId);
      const nextOrder = cats.reduce((m, c) => Math.max(m, c.order), 0) + 1;

      const { data: newEtc, error: etcError } = await client
        .from('categories')
        .insert({ owner_id: ownerId, name: 'ETC', sort_order: nextOrder })
        .select('id')
        .single();

      if (etcError) return { ok: false, error: etcError.message };
      etc = newEtc;
    }

    await client
      .from('services')
      .update({ category_id: etc.id })
      .eq('category_id', catId);

    const { error } = await client
      .from('categories')
      .delete()
      .eq('id', catId);

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  /* ───────────────── SERVICES ───────────────── */

  async function userServices(ownerId) {
    const { data, error } = await sb()
      .from('services')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) return [];

    return data.map(s => ({
      id: s.id,
      ownerId: s.owner_id,
      title: s.title,
      categoryId: s.category_id,
      url: s.url,
      summary: s.summary,
      plan: s.plan,
      monthlyCost: s.monthly_cost,
      important: s.important,
      loginId: s.login_id,
      loginPass: s.login_pass,
      memo: s.memo
    }));
  }

  async function saveService(ownerId, payload) {
    const client = sb();

    const row = {
      owner_id: ownerId,
      title: payload.title,
      category_id: payload.categoryId,
      url: payload.url || '',
      summary: payload.summary || '',
      plan: payload.plan || 'Free',
      monthly_cost: Number(payload.monthlyCost || 0),
      important: !!payload.important,
      login_id: payload.loginId || '',
      login_pass: payload.loginPass || '',
      memo: payload.memo || ''
    };

    if (payload.id) {
      const { error } = await client
        .from('services')
        .update(row)
        .eq('id', payload.id)
        .eq('owner_id', ownerId);

      return error ? { ok: false, error: error.message } : { ok: true };
    }

    const { error } = await client
      .from('services')
      .insert(row);

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function deleteService(ownerId, serviceId) {
    const { error } = await sb()
      .from('services')
      .delete()
      .eq('id', serviceId)
      .eq('owner_id', ownerId);

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  window.AppDB = {
    esc,
    formatMoney,
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    signup,
    login,
    logout,
    updateOwnAccount,
    deleteOwnAccount,
    loadDB,
    getUserById,
    adminApproveUser,
    adminRestoreTrial,
    adminDisableUser,
    adminDeleteUser,
    adminSetMaxActiveUsers,
    userCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    userServices,
    saveService,
    deleteService
  };
})();
