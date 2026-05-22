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
  PhysicalTable,
  Field,
  TableType,
  CreatePhysicalTableRequest,
  UpdatePhysicalTableRequest,
  CreateFieldRequest,
  UpdateFieldRequest,
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

// ==================== 物理表 API ====================

export async function fetchPhysicalTables(
  search?: string,
  tableType?: TableType
): Promise<ApiResponse<PhysicalTable[]>> {
  let query = supabase
    .from('physical_tables')
    .select('*, fields:fields(count)')
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  if (tableType) {
    query = query.eq('table_type', tableType);
  }

  const { data, error } = await query;

  // Transform the result to include field count
  const transformedData = data?.map((table) => ({
    ...table,
    field_count: (table.fields as unknown as { count: number }[])?.[0]?.count || 0,
  })) as PhysicalTable[] | undefined;

  return { data: transformedData || [], error: error?.message };
}

export async function fetchPhysicalTableById(id: string): Promise<ApiResponse<PhysicalTable>> {
  const { data, error } = await supabase
    .from('physical_tables')
    .select('*, fields(*)')
    .eq('id', id)
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function createPhysicalTable(
  request: CreatePhysicalTableRequest
): Promise<ApiResponse<PhysicalTable>> {
  const { data, error } = await supabase
    .from('physical_tables')
    .insert({
      name: request.name,
      code: request.code,
      table_type: request.table_type,
      description: request.description,
    })
    .select()
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function updatePhysicalTable(
  id: string,
  request: UpdatePhysicalTableRequest
): Promise<ApiResponse<PhysicalTable>> {
  const { data, error } = await supabase
    .from('physical_tables')
    .update(request)
    .eq('id', id)
    .select()
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function deletePhysicalTable(id: string): Promise<ApiResponse<void>> {
  const { error } = await supabase.from('physical_tables').delete().eq('id', id);
  return { error: error?.message };
}

// ==================== 字段 API ====================

export async function fetchFields(tableId?: string): Promise<ApiResponse<Field[]>> {
  let query = supabase.from('fields').select('*').order('created_at', { ascending: true });

  if (tableId) {
    query = query.eq('table_id', tableId);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function createField(request: CreateFieldRequest): Promise<ApiResponse<Field>> {
  const { data, error } = await supabase
    .from('fields')
    .insert({
      name: request.name,
      type: request.type,
      field_role: request.field_role,
      table_id: request.table_id,
      dimension_ref_id: request.dimension_ref_id,
      description: request.description,
      is_join_key: request.is_join_key || false,
    })
    .select()
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function updateField(
  id: string,
  request: UpdateFieldRequest
): Promise<ApiResponse<Field>> {
  const { data, error } = await supabase
    .from('fields')
    .update(request)
    .eq('id', id)
    .select()
    .single();

  return { data: data || undefined, error: error?.message };
}

export async function deleteField(id: string): Promise<ApiResponse<void>> {
  const { error } = await supabase.from('fields').delete().eq('id', id);
  return { error: error?.message };
}

// ==================== 辅助查询 ====================

/**
 * 获取所有维度表（用于雪花模型引用下拉）
 */
export async function fetchDimensionTables(): Promise<ApiResponse<PhysicalTable[]>> {
  const { data, error } = await supabase
    .from('physical_tables')
    .select('id, name, code')
    .eq('table_type', 'dimension')
    .order('name', { ascending: true });

  return { data: data || [], error: error?.message };
}
