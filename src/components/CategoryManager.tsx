"use client";

import { useState, useEffect } from "react";

interface CategoryRule {
  id: number;
  category: string;
  keywords: string;
  priority: number;
}

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
  onRulesChange: () => void;
}

export default function CategoryManager({ open, onClose, onRulesChange }: CategoryManagerProps) {
  const [rules, setRules] = useState<CategoryRule[]>([]);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Category Rules</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Existing rules */}
          <div className="space-y-3 mb-6">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{rule.category}</span>
                    <span className="text-xs text-gray-400">Priority: {rule.priority}</span>
                  </div>
                  <p className="text-xs text-gray-500 break-words">{rule.keywords}</p>
                </div>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 border border-red-200 rounded hover:bg-red-50 shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
            {rules.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No rules yet</p>
            )}
          </div>

          {/* Add new rule */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Add New Rule</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Category Name</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. 投资理财"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Keywords (comma separated)</label>
                <input
                  type="text"
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  placeholder="e.g. stock,invest,fund,portfolio,dividend"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Priority (higher = match first)</label>
                  <input
                    type="number"
                    value={newPriority}
                    onChange={(e) => setNewPriority(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!newCategory.trim() || !newKeywords.trim()}
                  className="mt-5 px-6 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
