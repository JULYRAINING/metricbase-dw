/**
 * SQL 执行器
 * 在 Edge Function 中执行生成的 SQL 查询
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { QueryResult } from "./types.ts";

interface ExecuteOptions {
  sql: string;
  page?: number;
  pageSize?: number;
}

/**
 * 执行 SQL 查询
 *
 * 注意: 需要 Supabase SQL API 权限
 * 或者连接到外部数据仓库
 */
export async function executeQuery(
  options: ExecuteOptions
): Promise<QueryResult> {
  const { sql, page = 1, pageSize = 100 } = options;

  // 获取 Supabase 客户端配置
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 使用 Supabase 的 rpc 执行 SQL
    // 注意: 需要预先创建执行 SQL 的函数
    const { data, error } = await supabase.rpc("execute_sql", {
      query: sql,
    });

    if (error) {
      return {
        columns: [],
        rows: [],
        total: 0,
        sql,
      };
    }

    // 解析结果
    const rows = Array.isArray(data) ? data : [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    // 转换为数组格式
    const rowsArray = rows.map((row: Record<string, unknown>) =>
      columns.map((col) => row[col])
    );

    return {
      columns,
      rows: rowsArray,
      total: rows.length,
      sql,
    };
  } catch (err) {
    console.error("SQL execution error:", err);
    return {
      columns: [],
      rows: [],
      total: 0,
      sql,
    };
  }
}

/**
 * 仅预览 SQL（用于调试）
 */
export function previewSQL(sql: string): { sql: string; formatted: string } {
  // 简单的格式化
  const formatted = sql
    .replace(/\s+/g, " ")
    .replace(/\)\s*SELECT/g, ")\nSELECT")
    .replace(/\)\s*FROM/g, ")\nFROM")
    .replace(/SELECT/g, "\nSELECT")
    .replace(/FROM/g, "\nFROM")
    .replace(/WHERE/g, "\nWHERE")
    .replace(/GROUP BY/g, "\nGROUP BY")
    .replace(/ORDER BY/g, "\nORDER BY")
    .replace(/LIMIT/g, "\nLIMIT")
    .replace(/UNION ALL/g, "\nUNION ALL\n")
    .trim();

  return { sql, formatted };
}

/**
 * 验证 SQL 语法（基础检查）
 */
export function validateSQL(sql: string): { valid: boolean; error?: string } {
  if (!sql || sql.trim() === "") {
    return { valid: false, error: "SQL is empty" };
  }

  // 基础安全检查
  const forbiddenKeywords = ["DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE"];
  const upperSql = sql.toUpperCase();

  for (const keyword of forbiddenKeywords) {
    if (upperSql.includes(keyword)) {
      return {
        valid: false,
        error: `Forbidden keyword detected: ${keyword}`,
      };
    }
  }

  // 检查是否是 SELECT 语句开头
  if (!upperSql.trim().startsWith("WITH") && !upperSql.trim().startsWith("SELECT")) {
    return {
      valid: false,
      error: "SQL must start with WITH or SELECT",
    };
  }

  return { valid: true };
}
