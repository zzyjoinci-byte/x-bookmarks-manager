"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface BookmarkCardProps {
  id: string;
  text: string;
  authorName: string;
  authorUsername: string;
  createdAt: string;
  category: string;
  mediaUrls: string;
  categories: string[];
  onCategoryChange: (id: string, category: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  "技术/开发": "bg-blue-100 text-blue-800 border-blue-200",
  "AI/机器学习": "bg-purple-100 text-purple-800 border-purple-200",
  "设计": "bg-pink-100 text-pink-800 border-pink-200",
  "加密货币": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "出海/网络": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "金融/投资": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "生活/健康": "bg-orange-100 text-orange-800 border-orange-200",
  "新闻/时事": "bg-red-100 text-red-800 border-red-200",
  "工具/产品": "bg-green-100 text-green-800 border-green-200",
  "uncategorized": "bg-gray-100 text-gray-600 border-gray-200",
};

const CATEGORY_DOT_COLORS: Record<string, string> = {
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

export default function BookmarkCard({
  id,
  text,
  authorName,
  authorUsername,
  createdAt,
  category,
  mediaUrls,
  categories,
  onCategoryChange,
}: BookmarkCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const colorClass = CATEGORY_COLORS[category] || "bg-gray-100 text-gray-600 border-gray-200";

  let images: string[] = [];
  try {
    images = JSON.parse(mediaUrls || "[]");
  } catch {
    images = [];
  }

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuHeight = 240;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
      // Show below
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    } else {
      // Show above
      setDropdownPos({ top: rect.top - menuHeight - 4, left: rect.left });
    }
  }, []);

  function handleToggle() {
    if (!showDropdown) {
      updatePosition();
    }
    setShowDropdown(!showDropdown);
  }

  // Close on click outside
  useEffect(() => {
    if (!showDropdown) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    function handleScroll() {
      setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [showDropdown]);

  const allOptions = [...categories.filter((c) => c !== "uncategorized"), "uncategorized"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {images.length > 0 && (
        <div className={`grid ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-0.5`}>
          {images.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className={`w-full object-cover ${images.length === 1 ? "max-h-52" : "h-32"}`}
              loading="lazy"
            />
          ))}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm truncate">{authorName}</span>
            <span className="text-gray-400 text-xs">@{authorUsername}</span>
          </div>
          <span className="text-gray-400 text-xs whitespace-nowrap">{formattedDate}</span>
        </div>

        <p className="text-sm text-gray-800 leading-relaxed mb-3 whitespace-pre-wrap break-words">
          {text}
        </p>

        <div className="flex items-center justify-between">
          <button
            ref={btnRef}
            onClick={handleToggle}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${colorClass} hover:opacity-80 transition-opacity`}
          >
            {category === "uncategorized" ? "未分类" : category}
            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <a
            href={`https://x.com/${authorUsername}/status/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            View on X
          </a>
        </div>
      </div>

      {/* Portal dropdown - rendered at body level */}
      {showDropdown &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-1 max-h-60 overflow-y-auto"
            style={{ top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
          >
            {allOptions.map((c) => {
              const isActive = c === category;
              const dotColor = CATEGORY_DOT_COLORS[c] || "bg-gray-400";
              return (
                <button
                  key={c}
                  onClick={() => {
                    if (c !== category) onCategoryChange(id, c);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                    isActive ? "bg-gray-50 font-semibold" : ""
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                  <span>{c === "uncategorized" ? "未分类" : c}</span>
                  {isActive && (
                    <svg className="w-3.5 h-3.5 ml-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
