import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Dimension, FactTable, Metric } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a mock client when environment variables are not available
const createMockClient = (): SupabaseClient => {
  const createQueryBuilder = () => {
    const builder = {
      data: [] as unknown[],
      error: null as Error | null,
      select: function() { return this; },
      insert: function() { return this; },
      update: function() { return this; },
      upsert: function() { return this; },
      delete: function() { return this; },
      eq: function() { return this; },
      neq: function() { return this; },
      gt: function() { return this; },
      gte: function() { return this; },
      lt: function() { return this; },
      lte: function() { return this; },
      like: function() { return this; },
      ilike: function() { return this; },
      in: function() { return this; },
      is: function() { return this; },
      contains: function() { return this; },
      containedBy: function() { return this; },
      overlaps: function() { return this; },
      textSearch: function() { return this; },
      match: function() { return this; },
      not: function() { return this; },
      or: function() { return this; },
      filter: function() { return this; },
      order: function() { return this; },
      limit: function() { return this; },
      range: function() { return this; },
      single: function() { return this; },
      maybeSingle: function() { return this; },
      csv: function() { return this; },
      then: function(callback: (result: { data: unknown[]; error: null }) => unknown) {
        return Promise.resolve(callback({ data: this.data, error: this.error }));
      },
    };
    return builder;
  };

  return {
    from: () => createQueryBuilder(),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  } as unknown as SupabaseClient;
};

export let supabase: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file. ' +
    'Using mock client for now.'
  );
  supabase = createMockClient();
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// 类型化的表访问
export const db = {
  dimensions: () => supabase.from('dimensions'),
  factTables: () => supabase.from('fact_tables'),
  metrics: () => supabase.from('metrics'),
};

export default supabase;
