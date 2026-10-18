/* DKsequence site analytics (GA4). Measurement ID lives only here. */
(function () {
  var ID = 'G-PENDING';
  if (!/^G-[A-Z0-9]{6,}$/.test(ID) || ID === 'G-PENDING') return;
  var host = location.hostname;
  if (host !== 'dksequence.com' && host !== 'www.dksequence.com') return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    region: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH']
  });
  gtag('js', new Date());
  gtag('config', ID, { allow_google_signals: false, allow_ad_personalization_signals: false });

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.href || '';
    var m = h.match(/play\.google\.com\/store\/apps\/details\?id=([\w.]+)/);
    if (m) { gtag('event', 'play_click', { app_id: m[1], page_path: location.pathname, transport_type: 'beacon' }); return; }
    if (/(youtube\.com|youtu\.be)\//.test(h)) gtag('event', 'youtube_click', { link_url: h, page_path: location.pathname, transport_type: 'beacon' });
  }, true);

  function note() {
    if (document.getElementById('dk-an-note')) return;
    var ko = (document.documentElement.lang || '').toLowerCase().indexOf('ko') === 0;
    var p = document.createElement('p');
    p.id = 'dk-an-note';
    p.style.cssText = 'margin:24px auto 16px;text-align:center;font-size:12px;opacity:.6';
    var a = document.createElement('a');
    a.href = '/privacy/website/';
    a.style.color = 'inherit';
    a.textContent = ko ? '\uc774 \uc0ac\uc774\ud2b8\ub294 \ubc29\ubb38 \ud1b5\uacc4\ub97c \uc218\uc9d1\ud569\ub2c8\ub2e4 \u00b7 \uc790\uc138\ud788' : 'This site collects visit statistics \u00b7 Details';
    p.appendChild(a);
    document.body.appendChild(p);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', note); else note();
})();
