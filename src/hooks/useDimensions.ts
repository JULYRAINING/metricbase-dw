import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { Dimension, CreateDimensionRequest, UpdateDimensionRequest } from '../types';
import {
  fetchDimensions,
  createDimension,
  updateDimension,
  deleteDimension,
} from '../lib/api';

export interface UseDimensionsReturn {
  dimensions: Dimension[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (data: CreateDimensionRequest) => Promise<boolean>;
  update: (id: string, data: UpdateDimensionRequest) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function useDimensions(search?: string): UseDimensionsReturn {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchDimensions(search);
      if (response.error) {
        setError(response.error);
        toast.error(`加载维度失败: ${response.error}`);
      } else {
        setDimensions(response.data || []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      toast.error(`加载维度失败: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const create = useCallback(async (data: CreateDimensionRequest): Promise<boolean> => {
    try {
      const response = await createDimension(data);
      if (response.error) {
        toast.error(`创建维度失败: ${response.error}`);
        return false;
      }
      toast.success('维度创建成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`创建维度失败: ${message}`);
      return false;
    }
  }, [refetch]);

  const update = useCallback(async (id: string, data: UpdateDimensionRequest): Promise<boolean> => {
    try {
      const response = await updateDimension(id, data);
      if (response.error) {
        toast.error(`更新维度失败: ${response.error}`);
        return false;
      }
      toast.success('维度更新成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`更新维度失败: ${message}`);
      return false;
    }
  }, [refetch]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await deleteDimension(id);
      if (response.error) {
        toast.error(`删除维度失败: ${response.error}`);
        return false;
      }
      toast.success('维度删除成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`删除维度失败: ${message}`);
      return false;
    }
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    dimensions,
    loading,
    error,
    refetch,
    create,
    update,
    remove,
  };
}

export default useDimensions;
