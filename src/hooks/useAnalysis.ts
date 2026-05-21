/**
 * 多维分析查询 Hook
 */

import { useState, useCallback } from "react";
import type { AnalysisResult, AnalysisFilters } from "../types";

const API_BASE = "/make-server-7b7e4046";

interface QueryParams {
  indicator_ids: string[];
  dimension_ids: string[];
  filters?: AnalysisFilters[];
  order_by?: string;
  page?: number;
  page_size?: number;
}

interface UseAnalysisReturn {
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  executeQuery: (params: QueryParams) => Promise<void>;
  previewSQL: (params: QueryParams) => Promise<string | null>;
  clearResult: () => void;
}

export function useAnalysis(): UseAnalysisReturn {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = useCallback(async (params: QueryParams) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/analysis/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "查询失败");
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const previewSQL = useCallback(async (params: QueryParams): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE}/analysis/preview-sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "生成 SQL 失败");
      }

      return data.data.sql;
    } catch (err) {
      console.error("Preview SQL error:", err);
      return null;
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    result,
    loading,
    error,
    executeQuery,
    previewSQL,
    clearResult,
  };
}