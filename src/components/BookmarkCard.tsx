"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { categoryColorClass, categoryDotClass } from "@/lib/category-colors";
import { parseJsonArray, resolveImageSrc } from "@/lib/bookmark-shape";
import { useT } from "@/lib/language-context";

interface BookmarkCardProps {
  id: string;
  text: string;
  authorName: string;
  authorUsername: string;
  createdAt: string;
  category: string;
  mediaUrls: string;
  localMedia?: string;
  categories: string[];
  onCategoryChange: (id: string, category: string) => void;
  onOpen?: () => void;
}

export default function BookmarkCard({
  id,
  text,
  authorName,
  authorUsername,
  createdAt,
  category,
  mediaUrls,
  localMedia,
  categories,
  onCategoryChange,
  onOpen,
}: BookmarkCardProps) {
  const { t, lang, categoryLabel } = useT();
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const colorClass = categoryColorClass(category);

  const images = parseJsonArray(mediaUrls);
  const localImages = parseJsonArray(localMedia);

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
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
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    } else {
      setDropdownPos({ top: rect.top - menuHeight - 4, left: rect.left });
    }
  }, []);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!showDropdown) {
      updatePosition();
    }
    setShowDropdown(!showDropdown);
  }

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
    function handleScroll(e: Event) {
      // Ignore scrolls that happen inside the dropdown itself — those are the
      // user actually scrolling the category list; only outer scrolls close.
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
        return;
      }
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

  function handleCardClick() {
    if (showDropdown) return;
    onOpen?.();
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen?.();
    }
  }

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md dark:hover:border-gray-700 transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {images.length > 0 && (
        <div className={`grid ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-0.5`}>
          {images.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={resolveImageSrc(url, localImages[i])}
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
            <span className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{authorName}</span>
            <span className="text-gray-400 dark:text-gray-500 text-xs">@{authorUsername}</span>
          </div>
          <span className="text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">{formattedDate}</span>
        </div>

        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-3 whitespace-pre-wrap break-words line-clamp-5">
          {text}
        </p>

        <div className="flex items-center justify-between">
          <button
            ref={btnRef}
            onClick={handleToggle}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${colorClass} hover:opacity-80 transition-opacity`}
          >
            {categoryLabel(category)}
            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <a
            href={`https://x.com/${authorUsername}/status/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            {t("viewOnX")}
          </a>
        </div>
      </div>

      {showDropdown &&
        createPortal(
          <div
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            className="fixed w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 max-h-60 overflow-y-auto"
            style={{ top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
          >
            {allOptions.map((c) => {
              const isActive = c === category;
              const dotColor = categoryDotClass(c);
              return (
                <button
                  key={c}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (c !== category) onCategoryChange(id, c);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    isActive ? "bg-gray-50 dark:bg-gray-800 font-semibold" : ""
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                  <span>{categoryLabel(c)}</span>
                  {isActive && (
                    <svg className="w-3.5 h-3.5 ml-auto text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
