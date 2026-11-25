/* PANDA SUKSESS — konfigurasi.
 * Isi supabaseUrl + supabaseAnonKey supaya hasil edit tersimpan bersama (dilihat semua orang).
 * Kalau dikosongkan, web tetap jalan: hasil edit tersimpan di browser ini saja, PIN = localPin.
 */
window.PANDA_CONFIG = {
  supabaseUrl: '',          // contoh: 'https://abcdxyz.supabase.co'
  supabaseAnonKey: '',      // Project Settings › API › anon public key
  deckId: 'kebayoran',      // sama dengan id di supabase.sql
  localPin: '2026',         // PIN edit saat Supabase belum diisi
};
