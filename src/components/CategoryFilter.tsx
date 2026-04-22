"use client";

import { useT } from "@/lib/language-context";

interface CategoryFilterProps {
  categories: string[];
  counts: Record<string, number>;
  selected: string;
  onSelect: (category: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
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

export default function CategoryFilter({
  categories,
  counts,
  selected,
  onSelect,
}: CategoryFilterProps) {
  const { t, categoryLabel } = useT();
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect("all")}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          selected === "all"
            ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
      >
        {t("all")} ({totalCount})
      </button>
      {categories.map((cat) => {
        const dotColor = CATEGORY_COLORS[cat] || "bg-gray-400";
        const isActive = selected === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
              isActive
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : dotColor}`} />
            {categoryLabel(cat)} ({counts[cat] || 0})
          </button>
        );
      })}
    </div>
  );
}
