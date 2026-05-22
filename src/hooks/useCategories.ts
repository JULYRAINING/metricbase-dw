import { useState, useCallback } from "react";
import type { Category } from "../types";

const API_BASE = "/api";

interface CategoryNode extends Category {
  children: CategoryNode[];
}

export interface UseCategoriesReturn {
  categories: Category[];
  categoryTree: CategoryNode[];
  loading: boolean;
  error: string | null;
  fetchCategories: (search?: string, parentId?: string | null) => Promise<Category[]>;
  fetchCategoryTree: () => Promise<CategoryNode[]>;
  createCategory: (data: Omit<Category, "id" | "created_at" | "updated_at" | "path" | "level">) => Promise<Category | null>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<Category | null>;
  deleteCategory: (id: string) => Promise<boolean>;
}

export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("sb-token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // 获取分类列表
  const fetchCategories = useCallback(async (search?: string, parentId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (parentId !== undefined) params.append("parent_id", parentId || "");

      const response = await fetch(`${API_BASE}/categories?${params}`, {
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "获取分类列表失败");
      }

      setCategories(result.data || []);
      return result.data || [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "获取分类列表失败";
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取分类树
  const fetchCategoryTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/categories/tree`, {
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "获取分类树失败");
      }

      setCategoryTree(result.data || []);
      return result.data || [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "获取分类树失败";
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 创建分类
  const createCategory = useCallback(async (data: Omit<Category, "id" | "created_at" | "updated_at" | "path" | "level">) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/categories`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "创建分类失败");
      }

      await fetchCategoryTree();
      return result.data as Category;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建分类失败";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchCategoryTree]);

  // 更新分类
  const updateCategory = useCallback(async (id: string, data: Partial<Category>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/categories/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "更新分类失败");
      }

      await fetchCategoryTree();
      return result.data as Category;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "更新分类失败";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchCategoryTree]);

  // 删除分类
  const deleteCategory = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/categories/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "删除分类失败");
      }

      await fetchCategoryTree();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "删除分类失败";
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchCategoryTree]);

  return {
    categories,
    categoryTree,
    loading,
    error,
    fetchCategories,
    fetchCategoryTree,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
