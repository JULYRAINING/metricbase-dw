import { supabase } from './supabase';
import type {
  Dimension,
  FactTable,
  Metric,
  MetricType,
  ApiResponse,
  CreateDimensionRequest,
  UpdateDimensionRequest,
  CreateFactTableRequest,
  UpdateFactTableRequest,
  CreateMetricRequest,
  UpdateMetricRequest,
} from '../types';

// ==================== 维度 API ====================

export async function fetchDimensions(search?: string): Promise<ApiResponse<Dimension[]>> {
  let query = supabase.from('dimensions').select('*').order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function createDimension(request: CreateDimensionRequest): Promise<ApiResponse<Dimension>> {
  const { data, error } = await supabase
    .from('dimensions')
    .insert(request)
    .select()
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function updateDimension(
  id: string,
  request: UpdateDimensionRequest
): Promise<ApiResponse<Dimension>> {
  const { data, error } = await supabase
    .from('dimensions')
    .update(request)
    .eq('id', id)
    .select()
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function deleteDimension(id: string): Promise<ApiResponse<void>> {
  const { error } = await supabase.from('dimensions').delete().eq('id', id);
  return { error: error?.message };
}

// ==================== 事实表 API ====================

export async function fetchFactTables(search?: string): Promise<ApiResponse<FactTable[]>> {
  let query = supabase.from('fact_tables').select('*').order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function createFactTable(request: CreateFactTableRequest): Promise<ApiResponse<FactTable>> {
  const { data, error } = await supabase
    .from('fact_tables')
    .insert(request)
    .select()
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function updateFactTable(
  id: string,
  request: UpdateFactTableRequest
): Promise<ApiResponse<FactTable>> {
  const { data, error } = await supabase
    .from('fact_tables')
    .update(request)
    .eq('id', id)
    .select()
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function deleteFactTable(id: string): Promise<ApiResponse<void>> {
  const { error } = await supabase.from('fact_tables').delete().eq('id', id);
  return { error: error?.message };
}

// ==================== 指标 API ====================

export async function fetchMetrics(type?: MetricType, search?: string): Promise<ApiResponse<Metric[]>> {
  let query = supabase.from('metrics').select('*').order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function createMetric(request: CreateMetricRequest): Promise<ApiResponse<Metric>> {
  const { data, error } = await supabase
    .from('metrics')
    .insert(request)
    .select()
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function updateMetric(
  id: string,
  request: UpdateMetricRequest
): Promise<ApiResponse<Metric>> {
  const { data, error } = await supabase
    .from('metrics')
    .update(request)
    .eq('id', id)
    .select()
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function deleteMetric(id: string): Promise<ApiResponse<void>> {
  const { error } = await supabase.from('metrics').delete().eq('id', id);
  return { error: error?.message };
}
