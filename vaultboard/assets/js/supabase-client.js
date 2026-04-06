(function () {
  const config = window.VaultBoardSupabaseConfig;

  if (!config || !config.supabaseUrl || !config.supabaseKey) {
    console.error('Supabase config is missing.');
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase library is not loaded.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseKey
  );

  console.log('Supabase client ready.');
})();
