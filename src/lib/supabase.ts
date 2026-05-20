import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Dimension, FactTable, Metric } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// 类型化的表访问
export const db = {
  dimensions: () => supabase.from('dimensions'),
  factTables: () => supabase.from('fact_tables'),
  metrics: () => supabase.from('metrics'),
};

export default supabase;
