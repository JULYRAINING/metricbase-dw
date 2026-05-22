import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { PhysicalTable, TableType, CreatePhysicalTableRequest, UpdatePhysicalTableRequest } from '../types';
import {
  fetchPhysicalTables,
  createPhysicalTable,
  updatePhysicalTable,
  deletePhysicalTable,
} from '../lib/api';

export interface UsePhysicalTablesReturn {
  physicalTables: PhysicalTable[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (data: CreatePhysicalTableRequest) => Promise<boolean>;
  update: (id: string, data: UpdatePhysicalTableRequest) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function usePhysicalTables(search?: string, tableType?: TableType): UsePhysicalTablesReturn {
  const [physicalTables, setPhysicalTables] = useState<PhysicalTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPhysicalTables(search, tableType);
      if (response.error) {
        setError(response.error);
        toast.error(`加载物理表失败: ${response.error}`);
      } else {
        setPhysicalTables(response.data || []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      toast.error(`加载物理表失败: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [search, tableType]);

  const create = useCallback(async (data: CreatePhysicalTableRequest): Promise<boolean> => {
    try {
      const response = await createPhysicalTable(data);
      if (response.error) {
        toast.error(`创建物理表失败: ${response.error}`);
        return false;
      }
      toast.success('物理表创建成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`创建物理表失败: ${message}`);
      return false;
    }
  }, [refetch]);

  const update = useCallback(async (id: string, data: UpdatePhysicalTableRequest): Promise<boolean> => {
    try {
      const response = await updatePhysicalTable(id, data);
      if (response.error) {
        toast.error(`更新物理表失败: ${response.error}`);
        return false;
      }
      toast.success('物理表更新成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`更新物理表失败: ${message}`);
      return false;
    }
  }, [refetch]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await deletePhysicalTable(id);
      if (response.error) {
        toast.error(`删除物理表失败: ${response.error}`);
        return false;
      }
      toast.success('物理表删除成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`删除物理表失败: ${message}`);
      return false;
    }
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { physicalTables, loading, error, refetch, create, update, remove };
}

export default usePhysicalTables;
