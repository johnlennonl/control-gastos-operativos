const SUPABASE_URL = "https://mevvfyzznudfgodczgmx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ldnZmeXp6bnVkZmdvZGN6Z214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTkxNjAsImV4cCI6MjEwMDY3NTE2MH0.mt3VliZWm5zJvVxAwYpuTLtfU8xLvyfgY7VwD6viFr0";
const STORAGE_BUCKET = "comprobantes-gastos";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
