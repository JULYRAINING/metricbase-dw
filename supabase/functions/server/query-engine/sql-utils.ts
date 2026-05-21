/**
 * SQL 工具函数
 * 共享的 SQL 操作符映射和值格式化函数
 */

/**
 * 映射 SQL 操作符 - 白名单模式
 * 未知操作符将抛出错误而非透传，防止 SQL 注入
 */
export function mapSqlOperator(operator: string): string {
  const mapping: Record<string, string> = {
    eq: "=",
    ne: "!=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    in: "IN",
    nin: "NOT IN",
    like: "LIKE",
    ilike: "ILIKE",
    is_null: "IS NULL",
    is_not_null: "IS NOT NULL",
  };
  const mapped = mapping[operator];
  if (!mapped) {
    throw new Error(
      `Invalid operator: ${operator}. Allowed operators: ${Object.keys(mapping).join(", ")}`,
    );
  }
  return mapped;
}

/**
 * 格式化值
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "string") {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `(${value.map((v) => formatValue(v)).join(", ")})`;
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return String(value);
}
