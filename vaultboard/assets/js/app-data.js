(function(){
  const DB_KEY = 'private_dashboard_webapp_v1';
  const SESSION_KEY = 'private_dashboard_session_v1';

  function uid(prefix='id'){ return `${prefix}_${Math.random().toString(36).slice(2,10)}`; }
  function now(){ return new Date().toISOString(); }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function formatMoney(n){ return Number(n||0).toLocaleString('ko-KR') + '원'; }

  function seed(){
    const adminId = uid('user');
    const db = {
      settings: { maxActiveUsers: 10 },
      users: [
        {
          id: adminId,
          username: 'admin',
          password: 'admin123!',
          displayName: 'Primary Admin',
          role: 'admin',
          status: 'active',
          createdAt: now(),
          approvedAt: now()
        }
      ],
      categories: [
        { id: uid('cat'), ownerId: adminId, name: 'AI Tools', order: 1 },
        { id: uid('cat'), ownerId: adminId, name: 'Design', order: 2 },
        { id: uid('cat'), ownerId: adminId, name: 'Video / Motion', order: 3 },
        { id: uid('cat'), ownerId: adminId, name: 'Web / Hosting', order: 4 },
        { id: uid('cat'), ownerId: adminId, name: 'Marketing / SNS', order: 5 },
        { id: uid('cat'), ownerId: adminId, name: 'Productivity', order: 6 },
        { id: uid('cat'), ownerId: adminId, name: 'ETC', order: 7 }
      ],
      services: []
    };
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }

  function loadDB(){
    try{
      const raw = localStorage.getItem(DB_KEY);
      if(!raw) return seed();
      const parsed = JSON.parse(raw);
      if(!parsed || !Array.isArray(parsed.users)) return seed();
      return parsed;
    }catch(e){
      return seed();
    }
  }

  function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); return db; }
  function currentSession(){
    try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(e){ return null; }
  }
  function saveSession(session){ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  function currentUser(){
    const session = currentSession();
    if(!session?.userId) return null;
    return loadDB().users.find(u => u.id === session.userId) || null;
  }

  function activeUserCount(db){
    return db.users.filter(u => u.role !== 'admin' && u.status === 'active').length;
  }

  function signup({username,password,displayName}){
    const db = loadDB();
    if(db.users.some(u => u.username.toLowerCase() === String(username).toLowerCase())){
      return { ok:false, error:'이미 존재하는 ID입니다.' };
    }
    const user = {
      id: uid('user'), username, password, displayName: displayName || username,
      role: 'user', status: 'trial', createdAt: now(), approvedAt: null
    };
    db.users.push(user);
    const baseCats = ['AI Tools','Design','Video / Motion','Web / Hosting','Marketing / SNS','Productivity','ETC'];
    baseCats.forEach((name, idx) => db.categories.push({ id: uid('cat'), ownerId: user.id, name, order: idx+1 }));
    saveDB(db);
    saveSession({ userId: user.id });
    return { ok:true, user };
  }

  function login({username,password}){
    const db = loadDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    if(!user) return { ok:false, error:'ID 또는 비밀번호가 맞지 않습니다.' };
    if(user.status === 'disabled' || user.status === 'deleted') return { ok:false, error:'현재 사용할 수 없는 계정입니다.' };
    saveSession({ userId: user.id });
    return { ok:true, user };
  }

  function logout(){ clearSession(); }

  function updateOwnAccount(userId, payload){
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if(!user) return { ok:false };
    if(payload.displayName !== undefined) user.displayName = payload.displayName;
    if(payload.password !== undefined) user.password = payload.password;
    saveDB(db);
    return { ok:true, user };
  }

  function deleteOwnAccount(userId){
    const db = loadDB();
    db.users = db.users.filter(u => u.id !== userId);
    db.categories = db.categories.filter(c => c.ownerId !== userId);
    db.services = db.services.filter(s => s.ownerId !== userId);
    saveDB(db);
    clearSession();
    return { ok:true };
  }

  function listUsers(){ return loadDB().users.slice(); }
  function getUserById(userId){ return loadDB().users.find(u => u.id === userId) || null; }

  function adminSetMaxActiveUsers(max){
    const db = loadDB();
    db.settings.maxActiveUsers = Math.max(0, Number(max||0));
    saveDB(db);
    return { ok:true };
  }

  function adminApproveUser(userId){
    const db = loadDB();
    const user = db.users.find(u => u.id === userId && u.role !== 'admin');
    if(!user) return { ok:false, error:'사용자를 찾을 수 없습니다.' };
    if(activeUserCount(db) >= db.settings.maxActiveUsers) return { ok:false, error:'승인 가능한 활성 사용자 수를 초과했습니다.' };
    user.status = 'active';
    user.approvedAt = now();
    saveDB(db);
    return { ok:true };
  }

  function adminDisableUser(userId){
    const db = loadDB();
    const user = db.users.find(u => u.id === userId && u.role !== 'admin');
    if(!user) return { ok:false };
    user.status = 'disabled';
    saveDB(db);
    return { ok:true };
  }

  function adminDeleteUser(userId){
    const db = loadDB();
    db.users = db.users.filter(u => u.id !== userId);
    db.categories = db.categories.filter(c => c.ownerId !== userId);
    db.services = db.services.filter(s => s.ownerId !== userId);
    saveDB(db);
    return { ok:true };
  }

  function adminRestoreTrial(userId){
    const db = loadDB();
    const user = db.users.find(u => u.id === userId && u.role !== 'admin');
    if(!user) return { ok:false };
    user.status = 'trial';
    saveDB(db);
    return { ok:true };
  }

  function userCategories(ownerId){
    return loadDB().categories.filter(c => c.ownerId === ownerId).sort((a,b)=>a.order-b.order);
  }
  function userServices(ownerId){
    return loadDB().services.filter(s => s.ownerId === ownerId);
  }

  function addCategory(ownerId, name){
    const db = loadDB();
    const nextOrder = (db.categories.filter(c => c.ownerId === ownerId).reduce((m,c)=>Math.max(m,c.order),0) + 1) || 1;
    db.categories.push({ id: uid('cat'), ownerId, name, order: nextOrder });
    saveDB(db);
    return { ok:true };
  }
  function updateCategory(catId, name){
    const db = loadDB();
    const cat = db.categories.find(c => c.id === catId);
    if(!cat) return { ok:false };
    cat.name = name;
    saveDB(db);
    return { ok:true };
  }
  function deleteCategory(catId){
    const db = loadDB();
    const cat = db.categories.find(c => c.id === catId);
    if(!cat) return { ok:false };
    let etc = db.categories.find(c => c.ownerId === cat.ownerId && c.name === 'ETC');
    if(!etc){
      etc = { id: uid('cat'), ownerId: cat.ownerId, name:'ETC', order:999 };
      db.categories.push(etc);
    }
    db.services.filter(s => s.categoryId === catId).forEach(s => s.categoryId = etc.id);
    db.categories = db.categories.filter(c => c.id !== catId);
    saveDB(db);
    return { ok:true };
  }

  function saveService(ownerId, payload){
    const db = loadDB();
    if(payload.id){
      const service = db.services.find(s => s.id === payload.id && s.ownerId === ownerId);
      if(!service) return { ok:false };
      Object.assign(service, payload);
    }else{
      db.services.push({
        id: uid('svc'), ownerId,
        title: payload.title, categoryId: payload.categoryId, url: payload.url || '',
        summary: payload.summary || '', plan: payload.plan || 'Free', monthlyCost: Number(payload.monthlyCost||0),
        important: !!payload.important, loginId: payload.loginId || '', loginPass: payload.loginPass || '', memo: payload.memo || ''
      });
    }
    saveDB(db);
    return { ok:true };
  }
  function deleteService(ownerId, serviceId){
    const db = loadDB();
    db.services = db.services.filter(s => !(s.id === serviceId && s.ownerId === ownerId));
    saveDB(db);
    return { ok:true };
  }

  window.AppDB = {
    uid, now, clone, formatMoney,
    loadDB, saveDB,
    currentUser, currentSession,
    signup, login, logout,
    updateOwnAccount, deleteOwnAccount,
    listUsers, getUserById,
    adminSetMaxActiveUsers, adminApproveUser, adminDisableUser, adminDeleteUser, adminRestoreTrial,
    userCategories, userServices, addCategory, updateCategory, deleteCategory, saveService, deleteService,
    activeUserCount
  };
})();
