import { useState, useCallback } from "react";
import type { Property } from "../types";

const API_BASE = "/api";

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("sb-token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // 获取字段列表
  const fetchProperties = useCallback(async (componentId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (componentId) params.append("component_id", componentId);

      const response = await fetch(`${API_BASE}/properties?${params}`, {
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "获取字段列表失败");
      }

      setProperties(result.data || []);
      return result.data || [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "获取字段列表失败";
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 创建字段
  const createProperty = useCallback(async (data: Omit<Property, "id" | "created_at" | "updated_at">) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/properties`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "创建字段失败");
      }

      return result.data as Property;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建字段失败";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 更新字段
  const updateProperty = useCallback(async (id: string, data: Partial<Property>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/properties/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "更新字段失败");
      }

      return result.data as Property;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "更新字段失败";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 删除字段
  const deleteProperty = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/properties/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "删除字段失败");
      }

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "删除字段失败";
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    properties,
    loading,
    error,
    fetchProperties,
    createProperty,
    updateProperty,
    deleteProperty,
  };
}
