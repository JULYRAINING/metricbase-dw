/**
 * SQL 工具函数
 * 共享的 SQL 操作符映射和值格式化函数
 * 包含 SQL 注入防护验证
 */

// 允许的 SQL 标识符字符（表名、字段名）
const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// 禁止的 SQL 关键字（用于 condition 验证）
const FORBIDDEN_SQL_KEYWORDS = [
  "DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE", "INSERT",
  "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE", "UNION",
  "--", "/*", "*/", ";", "@@", "@", "xp_", "sp_",
];

// 允许的 SQL 操作符和表达式元素
const ALLOWED_CONDITION_PATTERN = /^[\w\s\(\)\.,=<>!*+\-/'"_%]+$/;

/**
 * 验证 SQL 标识符（表名、字段名）
 * 只允许字母、数字、下划线，且必须以字母或下划线开头
 */
export function validateIdentifier(name: string, context: string): string {
  if (!name) {
    throw new Error(`${context}: identifier cannot be empty`);
  }
  if (!IDENTIFIER_REGEX.test(name)) {
    throw new Error(
      `${context}: "${name}" is not a valid SQL identifier. ` +
      "Only letters, numbers, and underscores are allowed, starting with a letter or underscore."
    );
  }
  return name;
}

/**
 * 验证 condition 字符串，防止 SQL 注入
 * - 检查禁止的关键字
 * - 检查特殊字符
 * - 限制长度
 */
export function validateCondition(condition: string): string {
  if (!condition || condition.trim() === "") {
    return "";
  }

  // 限制长度防止 DoS
  if (condition.length > 1000) {
    throw new Error("Condition too long (max 1000 characters)");
  }

  const upperCondition = condition.toUpperCase();

  // 检查禁止的关键字
  for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
    if (upperCondition.includes(keyword)) {
      throw new Error(
        `Invalid condition: contains forbidden keyword "${keyword}"`
      );
    }
  }

  // 基础字符白名单检查
  if (!ALLOWED_CONDITION_PATTERN.test(condition)) {
    throw new Error(
      "Invalid condition: contains forbidden characters"
    );
  }

  // 检查括号平衡
  let parenCount = 0;
  for (const char of condition) {
    if (char === "(") parenCount++;
    if (char === ")") parenCount--;
    if (parenCount < 0) {
      throw new Error("Invalid condition: unbalanced parentheses");
    }
  }
  if (parenCount !== 0) {
    throw new Error("Invalid condition: unbalanced parentheses");
  }

  return condition;
}

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
 * 验证指标编码（用于公式中的变量）
 * 只允许字母、数字、下划线
 */
export function validateMetricCode(code: string): string {
  if (!code) {
    throw new Error("Metric code cannot be empty");
  }
  if (!IDENTIFIER_REGEX.test(code)) {
    throw new Error(
      `Invalid metric code: "${code}". ` +
      "Only letters, numbers, and underscores are allowed, starting with a letter or underscore."
    );
  }
  return code;
}

/**
 * 验证公式字符串
 * - 确保公式不包含危险字符
 * - 返回验证后的公式
 */
export function validateFormula(formula: string): string {
  if (!formula || formula.trim() === "") {
    return "";
  }

  // 限制长度
  if (formula.length > 500) {
    throw new Error("Formula too long (max 500 characters)");
  }

  // 检查禁止的关键字
  const upperFormula = formula.toUpperCase();
  for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
    if (upperFormula.includes(keyword)) {
      throw new Error(
        `Invalid formula: contains forbidden keyword "${keyword}"`
      );
    }
  }

  // 允许数字、操作符、括号、引号、变量占位符等
  const formulaPattern = /^[\w\s\(\)\{\}\.,+\-*/=<>!%]+$/;
  if (!formulaPattern.test(formula)) {
    throw new Error("Invalid formula: contains forbidden characters");
  }

  // 检查括号平衡
  let parenCount = 0;
  let braceCount = 0;
  for (const char of formula) {
    if (char === "(") parenCount++;
    if (char === ")") parenCount--;
    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
    if (parenCount < 0 || braceCount < 0) {
      throw new Error("Invalid formula: unbalanced parentheses or braces");
    }
  }
  if (parenCount !== 0 || braceCount !== 0) {
    throw new Error("Invalid formula: unbalanced parentheses or braces");
  }

  return formula;
}

/**
 * 格式化值
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "string") {
    // 限制字符串长度防止 DoS
    if (value.length > 1000) {
      throw new Error("String value too long (max 1000 characters)");
    }
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Invalid number value");
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    // 限制数组长度
    if (value.length > 100) {
      throw new Error("Array too long (max 100 items)");
    }
    return `(${value.map((v) => formatValue(v)).join(", ")})`;
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return String(value);
}
