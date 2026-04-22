export const CATEGORY_COLORS: Record<string, string> = {
  "技术/开发": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
  "AI/机器学习": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900",
  "设计": "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-900",
  "加密货币": "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-900",
  "出海/网络": "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-900",
  "金融/投资": "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  "生活/健康": "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900",
  "新闻/时事": "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
  "工具/产品": "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-900",
  "uncategorized": "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

export const CATEGORY_DOT_COLORS: Record<string, string> = {
  "技术/开发": "bg-blue-500",
  "AI/机器学习": "bg-purple-500",
  "设计": "bg-pink-500",
  "加密货币": "bg-yellow-500",
  "出海/网络": "bg-cyan-500",
  "金融/投资": "bg-emerald-500",
  "生活/健康": "bg-orange-500",
  "新闻/时事": "bg-red-500",
  "工具/产品": "bg-green-500",
  "uncategorized": "bg-gray-400",
};

export function categoryColorClass(category: string): string {
  return CATEGORY_COLORS[category] || "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
}

export function categoryDotClass(category: string): string {
  return CATEGORY_DOT_COLORS[category] || "bg-gray-400";
}
