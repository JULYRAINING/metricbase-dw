import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { Field, CreateFieldRequest, UpdateFieldRequest } from '../types';
import { fetchFields, createField, updateField, deleteField } from '../lib/api';

export interface UseFieldsReturn {
  fields: Field[];
  loading: boolean;
  error: string | null;
  fetchFieldsByTable: (tableId: string) => Promise<Field[]>;
  create: (data: CreateFieldRequest) => Promise<boolean>;
  update: (id: string, data: UpdateFieldRequest) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function useFields(): UseFieldsReturn {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFieldsByTable = useCallback(async (tableId: string): Promise<Field[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFields(tableId);
      if (response.error) {
        setError(response.error);
        toast.error(`加载字段失败: ${response.error}`);
        return [];
      }
      setFields(response.data || []);
      return response.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      toast.error(`加载字段失败: ${message}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateFieldRequest): Promise<boolean> => {
    try {
      const response = await createField(data);
      if (response.error) {
        toast.error(`创建字段失败: ${response.error}`);
        return false;
      }
      toast.success('字段创建成功');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`创建字段失败: ${message}`);
      return false;
    }
  }, []);

  const update = useCallback(async (id: string, data: UpdateFieldRequest): Promise<boolean> => {
    try {
      const response = await updateField(id, data);
      if (response.error) {
        toast.error(`更新字段失败: ${response.error}`);
        return false;
      }
      toast.success('字段更新成功');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`更新字段失败: ${message}`);
      return false;
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await deleteField(id);
      if (response.error) {
        toast.error(`删除字段失败: ${response.error}`);
        return false;
      }
      toast.success('字段删除成功');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`删除字段失败: ${message}`);
      return false;
    }
  }, []);

  return {
    fields,
    loading,
    error,
    fetchFieldsByTable,
    create,
    update,
    remove,
  };
}

export default useFields;
