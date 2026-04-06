(function(){
  const path = location.pathname.split('/').pop() || 'index.html';

  function getSupabaseProfile() {
    try {
      return JSON.parse(localStorage.getItem('vaultboard_supabase_user') || 'null');
    } catch (e) {
      return null;
    }
  }

  function getCurrentUser() {
    const supaUser = getSupabaseProfile();
    if (supaUser) return supaUser;

    if (window.AppDB && typeof window.AppDB.currentUser === 'function') {
      return window.AppDB.currentUser();
    }

    return null;
  }

  const user = getCurrentUser();

  function headerNav(){
    const isAdmin = user?.role === 'admin';
    const loggedIn = !!user;

    return `
      <header class="site-header">
        <div class="inner">
          <a class="brand" href="./index.html">
            <span class="brand-badge">◆</span>
            <span>Private Vault Board</span>
          </a>
          <nav class="nav">
            <a href="./index.html" class="${path==='index.html'?'active':''}">Home</a>
            ${loggedIn ? `<a href="./dashboard.html" class="${path==='dashboard.html'?'active':''}">Dashboard</a>` : `<a href="./login.html" class="${path==='login.html'?'active':''}">Login</a>`}
            ${!loggedIn ? `<a href="./signup.html" class="${path==='signup.html'?'active':''}">Sign Up</a>` : ''}
            <a href="./trial.html" class="${path==='trial.html'?'active':''}">Trial Guide</a>
            ${loggedIn ? `<a href="./account.html" class="${path==='account.html'?'active':''}">내 계정</a>` : ''}
            ${isAdmin ? `<a href="./admin.html" class="${path==='admin.html'||path==='admin-user.html'?'active':''}">Admin</a>` : ''}
            ${loggedIn ? `<button type="button" id="globalLogoutBtn">Logout</button>` : ''}
          </nav>
        </div>
      </header>`;
  }

  function footer(){
    return `<div class="footer-space"></div>`;
  }

  function mountIncludes(){
    document.querySelectorAll('[data-include="site-header"]').forEach(el => el.outerHTML = headerNav());
    document.querySelectorAll('[data-include="site-footer"]').forEach(el => el.outerHTML = footer());

    const logout = document.getElementById('globalLogoutBtn');
    if(logout){
      logout.addEventListener('click', async () => {
        localStorage.removeItem('vaultboard_supabase_user');

        if (window.supabaseClient) {
          try {
            await window.supabaseClient.auth.signOut();
          } catch (e) {
            console.error(e);
          }
        }

        if (window.AppDB && typeof window.AppDB.logout === 'function') {
          window.AppDB.logout();
        }

        location.href = './login.html';
      });
    }
  }

  function gate(){
    const needAuth = document.body.dataset.requireAuth === 'true';
    const needAdmin = document.body.dataset.requireAdmin === 'true';

    if(needAuth && !user){
      location.href = './login.html';
      return;
    }

    if(needAdmin && user?.role !== 'admin'){
      location.href = './dashboard.html';
      return;
    }
  }

  function trialBanner(){
    const holder = document.querySelector('[data-trial-banner]');
    if(!holder || !user) return;

    if(user.status === 'trial'){
      holder.innerHTML = `
        <div class="alert trial">
          현재 계정은 임시 체험 상태입니다.
          관리자 최종 승인 전에는 데이터가 언제든 삭제될 수 있습니다.
        </div>
      `;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    gate();
    mountIncludes();
    trialBanner();
  });
})();
