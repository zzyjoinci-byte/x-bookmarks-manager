"use client";

import { useState, useEffect } from "react";
import { useT } from "@/lib/language-context";

interface CategoryRule {
  id: number;
  category: string;
  keywords: string;
  priority: number;
}

interface BuiltinRule {
  category: string;
  priority: number;
  strong: string[];
  keywords: string[];
  urlKeywords: string[];
  authorKeywords: string[];
}

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
  onRulesChange: () => void;
}

export default function CategoryManager({ open, onClose, onRulesChange }: CategoryManagerProps) {
  const { t, categoryLabel } = useT();
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [builtins, setBuiltins] = useState<BuiltinRule[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newPriority, setNewPriority] = useState(5);

  useEffect(() => {
    if (open) loadRules();
  }, [open]);

  async function loadRules() {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setRules(data.rules || []);
    setBuiltins(data.builtins || []);
  }

  async function handleAdd() {
    if (!newCategory.trim() || !newKeywords.trim()) return;
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: newCategory.trim(),
        keywords: newKeywords.trim(),
        priority: newPriority,
      }),
    });
    setNewCategory("");
    setNewKeywords("");
    setNewPriority(5);
    await loadRules();
    onRulesChange();
  }

  async function handleDelete(id: number) {
    await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadRules();
    onRulesChange();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-transparent dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t("ruleTitle")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t("ruleBuiltinNote")}</p>

          {/* Built-in rules (read-only, from classifier.ts) */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {t("ruleBuiltinHeader")}
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase">
                {t("ruleReadonly")}
              </span>
            </div>
            <div className="space-y-2">
              {builtins.map((rule) => (
                <div
                  key={rule.category}
                  className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {categoryLabel(rule.category)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {t("rulePriority", { n: rule.priority })}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-400 break-words">
                    {rule.strong.length > 0 && (
                      <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-300">{t("ruleStrong")} </span>
                        {rule.strong.join(", ")}
                      </div>
                    )}
                    {rule.keywords.length > 0 && (
                      <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-300">{t("ruleKeywordsLabel")} </span>
                        {rule.keywords.join(", ")}
                      </div>
                    )}
                    {rule.urlKeywords.length > 0 && (
                      <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-300">{t("ruleUrlHosts")} </span>
                        {rule.urlKeywords.join(", ")}
                      </div>
                    )}
                    {rule.authorKeywords.length > 0 && (
                      <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-300">{t("ruleAuthors")} </span>
                        {rule.authorKeywords.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom rules (editable) */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-3">
              {t("ruleCustomHeader")}
            </h3>
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{rule.category}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{t("rulePriority", { n: rule.priority })}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 break-words">{rule.keywords}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 border border-red-200 dark:border-red-900/60 rounded hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
                  >
                    {t("ruleDelete")}
                  </button>
                </div>
              ))}
              {rules.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">{t("ruleNone")}</p>
              )}
            </div>
          </div>

          {/* Add new rule */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">{t("ruleAddHeader")}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t("ruleCategoryName")}</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder={t("ruleEgCategory")}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t("ruleKeywords")}</label>
                <input
                  type="text"
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  placeholder={t("ruleEgKeywords")}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t("rulePriorityHint")}</label>
                  <input
                    type="number"
                    value={newPriority}
                    onChange={(e) => setNewPriority(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!newCategory.trim() || !newKeywords.trim()}
                  className="mt-5 px-6 py-2 bg-black dark:bg-white text-white dark:text-black text-sm rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("ruleAdd")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
