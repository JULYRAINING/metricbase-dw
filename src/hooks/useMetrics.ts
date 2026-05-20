import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { Metric, MetricType, CreateMetricRequest, UpdateMetricRequest } from '../types';
import {
  fetchMetrics,
  createMetric,
  updateMetric,
  deleteMetric,
} from '../lib/api';

export interface UseMetricsReturn {
  metrics: Metric[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (data: CreateMetricRequest) => Promise<boolean>;
  update: (id: string, data: UpdateMetricRequest) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function useMetrics(type?: MetricType, search?: string): UseMetricsReturn {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMetrics(type, search);
      if (response.error) {
        setError(response.error);
        toast.error(`加载指标失败: ${response.error}`);
      } else {
        setMetrics(response.data || []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      toast.error(`加载指标失败: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [type, search]);

  const create = useCallback(async (data: CreateMetricRequest): Promise<boolean> => {
    try {
      const response = await createMetric(data);
      if (response.error) {
        toast.error(`创建指标失败: ${response.error}`);
        return false;
      }
      toast.success('指标创建成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`创建指标失败: ${message}`);
      return false;
    }
  }, [refetch]);

  const update = useCallback(async (id: string, data: UpdateMetricRequest): Promise<boolean> => {
    try {
      const response = await updateMetric(id, data);
      if (response.error) {
        toast.error(`更新指标失败: ${response.error}`);
        return false;
      }
      toast.success('指标更新成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`更新指标失败: ${message}`);
      return false;
    }
  }, [refetch]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await deleteMetric(id);
      if (response.error) {
        toast.error(`删除指标失败: ${response.error}`);
        return false;
      }
      toast.success('指标删除成功');
      await refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      toast.error(`删除指标失败: ${message}`);
      return false;
    }
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { metrics, loading, error, refetch, create, update, remove };
}

export default useMetrics;
