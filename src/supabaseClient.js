// Conexão do navegador com o Supabase.
// No navegador usamos o Supabase só para o login e para enviar/abrir arquivos.
// Todas as operações de CRUD passam pela nossa API (pasta /api), no back-end.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && chave ? createClient(url, chave) : null;
