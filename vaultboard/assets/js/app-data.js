/* ─── AppDB: Supabase 기반 데이터 레이어 ─────────────────────────────── */
(function () {
  /* ── HTML 이스케이프 유틸 ───────────────────────────── */
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

  /* ── 현재 로그인 사용자 (localStorage 캐시) ────────────── */
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

  /* ── Supabase 클라이언트 접근자 ─────────────────────── */
  function sb() {
    return window.supabaseClient;
  }

  /* ─────────────────────────────────────────────────────
     AUTH
  ───────────────────────────────────────────────────── */

  async function signup({ email, password, displayName, username }) {
    const client = sb();
    if (!client) return { ok: false, error: 'Supabase 클라이언트가 준비되지 않았습니다.' };

    // 1) Auth 계정 생성
    const { data: authData, error: authError } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || username || email } }
    });

    if (authError) return { ok: false, error: authError.message };
    if (!authData?.user) return { ok: false, error: '계정 생성 실패' };

    const userId = authData.user.id;

    // 2) profiles 행 삽입 (트리거가 없는 경우를 대비해 직접 upsert)
    const { error: profileError } = await client.from('profiles').upsert({
      id: userId,
      username: username || email,
      display_name: displayName || username || email,
      role: 'user',
      status: 'trial',
      created_at: new Date().toISOString()
    });

    if (profileError) {
      console.warn('profiles upsert warning:', profileError.message);
    }

    // 3) 기본 카테고리 생성
    const baseCats = [
      'AI Tools', 'Design', 'Video / Motion', 'Web / Hosting',
      'Marketing / SNS', 'Productivity', 'ETC'
    ];
    const catRows = baseCats.map((name, idx) => ({
      owner_id: userId, name, sort_order: idx + 1
    }));
    await client.from('categories').insert(catRows);

    // 4) 프로필 캐시 저장
    const profile = {
      id: userId,
      username: username || email,
      display_name: displayName || username || email,
      role: 'user',
      status: 'trial'
    };
    setCurrentUser(profile);

    return { ok: true, user: profile };
  }

  async function login({ email, password }) {
    const client = sb();
    if (!client) return { ok: false, error: 'Supabase 클라이언트가 준비되지 않았습니다.' };

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    if (!data?.user) return { ok: false, error: '사용자 정보를 찾을 수 없습니다.' };

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, username, display_name, role, status')
      .eq('id', data.user.id)
      .single();

    if (profileError) return { ok: false, error: '프로필 조회 실패: ' + profileError.message };

    if (profile.status === 'disabled') {
      await client.auth.signOut();
      return { ok: false, error: '비활성화된 계정입니다.' };
    }

    setCurrentUser(profile);
    return { ok: true, user: profile };
  }

  async function logout() {
    clearCurrentUser();
    if (sb()) await sb().auth.signOut().catch(() => {});
  }

  /* ─────────────────────────────────────────────────────
     ACCOUNT
  ───────────────────────────────────────────────────── */

  async function updateOwnAccount(userId, payload) {
    const client = sb();
    const update = {};
    if (payload.displayName !== undefined) update.display_name = payload.displayName;

    if (Object.keys(update).length) {
      const { error } = await client.from('profiles').update(update).eq('id', userId);
      if (error) return { ok: false, error: error.message };
    }

    if (payload.password) {
      const { error } = await client.auth.updateUser({ password: payload.password });
      if (error) return { ok: false, error: error.message };
    }

    // 캐시 갱신
    const user = getCurrentUser();
    if (user && payload.displayName !== undefined) {
      user.display_name = payload.displayName;
      setCurrentUser(user);
    }

    return { ok: true };
  }

  async function deleteOwnAccount(userId) {
    const client = sb();
    await client.from('services').delete().eq('owner_id', userId);
    await client.from('categories').delete().eq('owner_id', userId);
    // profiles 삭제 (cascade 설정 없는 경우 직접)
    await client.from('profiles').delete().eq('id', userId);
    clearCurrentUser();
    await client.auth.signOut().catch(() => {});
    return { ok: true };
  }

  /* ─────────────────────────────────────────────────────
     ADMIN
  ───────────────────────────────────────────────────── */

  async function loadDB() {
    const client = sb();
    if (!client) return { settings: { maxActiveUsers: 10 }, users: [] };

    const [settingsRes, usersRes] = await Promise.all([
      client.from('settings').select('*').single(),
      client.from('profiles').select('id, username, display_name, role, status, created_at, approved_at')
    ]);

    const settings = settingsRes.data || { max_active_users: 10 };
    const users = (usersRes.data || []).map(u => ({
      ...u,
      displayName: u.display_name,
      createdAt: u.created_at,
      approvedAt: u.approved_at
    }));

    return {
      settings: { maxActiveUsers: settings.max_active_users ?? 10 },
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
    const { error } = await client.from('profiles')
      .update({ status: 'active', approved_at: new Date().toISOString() })
      .eq('id', userId)
      .neq('role', 'admin');
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function adminRestoreTrial(userId) {
    const { error } = await sb().from('profiles')
      .update({ status: 'trial', approved_at: null })
      .eq('id', userId)
      .neq('role', 'admin');
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function adminDisableUser(userId) {
    const { error } = await sb().from('profiles')
      .update({ status: 'disabled' })
      .eq('id', userId)
      .neq('role', 'admin');
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function adminDeleteUser(userId) {
    const client = sb();
    await client.from('services').delete().eq('owner_id', userId);
    await client.from('categories').delete().eq('owner_id', userId);
    const { error } = await client.from('profiles').delete().eq('id', userId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function adminSetMaxActiveUsers(max) {
    const { error } = await sb().from('settings')
      .update({ max_active_users: Math.max(0, Number(max || 0)) })
      .eq('id', 1);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function getUserById(userId) {
    const { data, error } = await sb().from('profiles')
      .select('id, username, display_name, role, status')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return { ...data, displayName: data.display_name };
  }

  /* ─────────────────────────────────────────────────────
     CATEGORIES
  ───────────────────────────────────────────────────── */

  async function userCategories(ownerId) {
    const { data, error } = await sb().from('categories')
      .select('*')
      .eq('owner_id', ownerId)
      .order('sort_order', { ascending: true });
    if (error) return [];
    return data.map(c => ({ id: c.id, ownerId: c.owner_id, name: c.name, order: c.sort_order }));
  }

  async function addCategory(ownerId, name) {
    const cats = await userCategories(ownerId);
    const nextOrder = cats.reduce((m, c) => Math.max(m, c.order), 0) + 1;
    const { error } = await sb().from('categories')
      .insert({ owner_id: ownerId, name, sort_order: nextOrder });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function updateCategory(catId, name) {
    const { error } = await sb().from('categories').update({ name }).eq('id', catId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function deleteCategory(catId) {
    const client = sb();
    const { data: cat } = await client.from('categories').select('owner_id').eq('id', catId).single();
    if (!cat) return { ok: false };
    const ownerId = cat.owner_id;

    // ETC 카테고리 확보
    let { data: etc } = await client.from('categories')
      .select('id').eq('owner_id', ownerId).eq('name', 'ETC').single();

    if (!etc) {
      const cats = await userCategories(ownerId);
      const nextOrder = cats.reduce((m, c) => Math.max(m, c.order), 0) + 1;
      const { data: newEtc } = await client.from('categories')
        .insert({ owner_id: ownerId, name: 'ETC', sort_order: nextOrder })
        .select('id').single();
      etc = newEtc;
    }

    // 해당 카테고리의 서비스를 ETC로 이동
    if (etc) {
      await client.from('services').update({ category_id: etc.id }).eq('category_id', catId);
    }

    const { error } = await client.from('categories').delete().eq('id', catId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  /* ─────────────────────────────────────────────────────
     SERVICES
  ───────────────────────────────────────────────────── */

  async function userServices(ownerId) {
    const { data, error } = await sb().from('services')
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
      const { error } = await client.from('services').update(row).eq('id', payload.id).eq('owner_id', ownerId);
      return error ? { ok: false, error: error.message } : { ok: true };
    } else {
      const { error } = await client.from('services').insert(row);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
  }

  async function deleteService(ownerId, serviceId) {
    const { error } = await sb().from('services')
      .delete()
      .eq('id', serviceId)
      .eq('owner_id', ownerId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  /* ─────────────────────────────────────────────────────
     공개 API
  ───────────────────────────────────────────────────── */
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
