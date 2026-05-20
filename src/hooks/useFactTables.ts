import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { FactTable, CreateFactTableRequest, UpdateFactTableRequest } from '../types';
import {
  fetchFactTables,
  createFactTable,
  updateFactTable,
  deleteFactTable,
} from '../lib/api';

export interface UseFactTablesReturn {
  factTables: FactTable[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (data: CreateFactTableRequest) => Promise<boolean>;
  update: (id: string, data: UpdateFactTableRequest) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function useFactTables(search?: string): UseFactTablesReturn {
  const [factTables, setFactTables] = useState<FactTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFactTables(search);
      if (response.error) {
        setError(response.error);
        toast.error(`加载事实表失败: ${response.error}`);
      } else {
        setFactTables(response.data || []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      toast.error(`加载事实表失败: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const create = useCallback(async (data: CreateFactTableRequest): Promise<boolean> => {
    try {
      const response = await createFactTable(data);
      if (response.error) {
        toast.error(`创建事实表失败: ${response.error}`);
        return false;
      }
      toast.success('事实表创建成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`创建事实表失败: ${message}`);
      return false;
    }
  }, [refetch]);

  const update = useCallback(async (id: string, data: UpdateFactTableRequest): Promise<boolean> => {
    try {
      const response = await updateFactTable(id, data);
      if (response.error) {
        toast.error(`更新事实表失败: ${response.error}`);
        return false;
      }
      toast.success('事实表更新成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`更新事实表失败: ${message}`);
      return false;
    }
  }, [refetch]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await deleteFactTable(id);
      if (response.error) {
        toast.error(`删除事实表失败: ${response.error}`);
        return false;
      }
      toast.success('事实表删除成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`删除事实表失败: ${message}`);
      return false;
    }
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { factTables, loading, error, refetch, create, update, remove };
}

export default useFactTables;
