"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, MapPin, Navigation, Loader2 } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { searchPlaces, fetchRoutes, PlaceSearchResult } from "@/lib/api";

export const FloatingSearchBar: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    selectedOrigin,
    setSelectedDestination,
    setRoutes,
    setActiveRouteIndex,
    setIsLoadingRoutes,
  } = useNavigation();

  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // 300ms Debounced search trigger (min length >= 3)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      setSearchResults([]);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlaces(trimmed);
        setSearchResults(results);
        setSelectedIndex(-1);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, setSearchResults]);

  // Click-outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPlace = async (place: PlaceSearchResult) => {
    const dest = {
      lat: place.lat,
      lon: place.lon,
      name: place.display_name.split(",")[0],
    };
    setSelectedDestination(dest);
    setSearchQuery(dest.name);
    setSearchResults([]);
    setIsFocused(false);
    setSelectedIndex(-1);

    if (selectedOrigin) {
      setIsLoadingRoutes(true);
      try {
        const response = await fetchRoutes(
          selectedOrigin.lat,
          selectedOrigin.lon,
          dest.lat,
          dest.lon
        );
        if (response.success && response.candidates.length > 0) {
          setRoutes(response.candidates);
          setActiveRouteIndex(0);
        }
      } catch (err) {
        console.error("Routing error:", err);
      } finally {
        setIsLoadingRoutes(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const targetIdx = selectedIndex >= 0 ? selectedIndex : 0;
      if (searchResults[targetIdx]) {
        handleSelectPlace(searchResults[targetIdx]);
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedDestination(null);
    setRoutes([]);
    setSelectedIndex(-1);
  };

  return (
    <div ref={containerRef} className="fixed top-4 left-4 z-20 w-[calc(100vw-32px)] sm:w-[420px]">
      <div className="glass-panel rounded-2xl p-2.5 flex items-center gap-3 transition-all duration-300">
        <div className="w-9 h-9 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600 shrink-0">
          <Navigation className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search destination in Bengaluru..."
          className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 font-medium text-sm"
        />
        {isSearching ? (
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0 mr-1" />
        ) : searchQuery ? (
          <button
            onClick={handleClear}
            className="w-7 h-7 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-500 hover:text-slate-800 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <Search className="w-5 h-5 text-slate-400 shrink-0 mr-1" />
        )}
      </div>

      {/* Dropdown Search Results */}
      {isFocused && searchResults.length > 0 && (
        <div className="absolute top-full mt-2 w-full glass-panel rounded-2xl shadow-2xl overflow-hidden z-30 border border-slate-200/80 max-h-80 overflow-y-auto">
          {searchResults.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPlace(item)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-slate-100 last:border-0 transition ${
                idx === selectedIndex ? "bg-blue-100/80 text-blue-900 font-semibold" : "hover:bg-blue-50/70"
              }`}
            >
              <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {item.display_name.split(",")[0]}
                </p>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {item.display_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
