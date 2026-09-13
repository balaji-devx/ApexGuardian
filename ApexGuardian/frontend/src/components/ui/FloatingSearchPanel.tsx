"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, ArrowUpDown, Loader2, MousePointerClick, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { searchPlaces, PlaceSearchResult } from "@/lib/api";

export const FloatingSearchPanel: React.FC = () => {
  const {
    sourceQuery,
    setSourceQuery,
    destinationQuery,
    setDestinationQuery,
    searchResults,
    setSearchResults,
    selectedOrigin,
    setSelectedOrigin,
    selectedDestination,
    setSelectedDestination,
    calculateRoutes,
    swapSourceAndDestination,
    pinDropMode,
    setPinDropMode,
    isEmergencyMode,
    toggleEmergencyMode,
  } = useNavigation();

  const [activeInput, setActiveInput] = useState<"source" | "destination" | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search trigger for active input field
  useEffect(() => {
    const currentQuery = activeInput === "source" ? sourceQuery : activeInput === "destination" ? destinationQuery : "";
    const trimmed = currentQuery.trim();

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
  }, [sourceQuery, destinationQuery, activeInput, setSearchResults]);

  // Click outside hook
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveInput(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPlace = async (place: PlaceSearchResult) => {
    const coord = {
      lat: place.lat,
      lon: place.lon,
      name: place.display_name.split(",")[0],
    };

    if (activeInput === "source") {
      setSelectedOrigin(coord);
      setSourceQuery(coord.name);
      if (selectedDestination) {
        await calculateRoutes(coord, selectedDestination);
      }
    } else if (activeInput === "destination") {
      setSelectedDestination(coord);
      setDestinationQuery(coord.name);
      if (selectedOrigin) {
        await calculateRoutes(selectedOrigin, coord);
      }
    }

    setSearchResults([]);
    setActiveInput(null);
    setSelectedIndex(-1);
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
      setActiveInput(null);
    }
  };

  return (
    <div ref={containerRef} className="w-full relative pointer-events-auto shrink-0">
      <div
        className={`glass-panel rounded-2xl p-3 shadow-2xl transition-all duration-300 space-y-2 border ${
          isEmergencyMode
            ? "border-rose-500/90 shadow-[0_0_30px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50 bg-rose-950/10"
            : "border-slate-200/80"
        }`}
      >
        {/* Emergency Mode Toggle Banner */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isEmergencyMode ? "bg-rose-500 animate-ping" : "bg-slate-300"
              }`}
            />
            <span
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isEmergencyMode ? "text-rose-700 dark:text-rose-400" : "text-slate-500"
              }`}
            >
              <Siren className={`w-3.5 h-3.5 ${isEmergencyMode ? "text-rose-600 animate-pulse" : "text-slate-400"}`} />
              Emergency / Ambulance Mode
            </span>
          </div>

          <button
            onClick={toggleEmergencyMode}
            type="button"
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isEmergencyMode ? "bg-rose-600 shadow-sm shadow-rose-500/50" : "bg-slate-300"
            }`}
            role="switch"
            aria-checked={isEmergencyMode}
            title="Toggle Emergency / Ambulance Priority Mode"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isEmergencyMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Source Input */}
        <div
          className={`relative flex items-center gap-2.5 rounded-xl p-2 transition border ${
            isEmergencyMode
              ? "bg-white/90 border-rose-200"
              : "bg-white/70 hover:bg-white border-slate-200/60"
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm shrink-0 ml-1" />
          <input
            type="text"
            value={sourceQuery}
            onChange={(e) => setSourceQuery(e.target.value)}
            onFocus={() => setActiveInput("source")}
            onKeyDown={handleKeyDown}
            placeholder="Choose starting point or drop pin..."
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 font-semibold text-xs sm:text-sm"
          />
          {activeInput === "source" && isSearching && (
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
          )}
          {sourceQuery && (
            <button
              onClick={() => {
                setSourceQuery("");
                setSelectedOrigin(null);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Swap & Pin Drop Action Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex gap-2">
            <button
              onClick={() => setPinDropMode(pinDropMode === "source" ? "none" : "source")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                pinDropMode === "source"
                  ? "bg-emerald-600 text-white shadow-sm animate-pulse"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>{pinDropMode === "source" ? "Click Map to Set Start" : "Drop Start Pin"}</span>
            </button>

            <button
              onClick={() => setPinDropMode(pinDropMode === "destination" ? "none" : "destination")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                pinDropMode === "destination"
                  ? "bg-rose-600 text-white shadow-sm animate-pulse"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>{pinDropMode === "destination" ? "Click Map to Set Dest" : "Drop Dest Pin"}</span>
            </button>
          </div>

          <button
            onClick={swapSourceAndDestination}
            title="Swap Source and Destination"
            className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition shadow-sm"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Destination Input */}
        <div
          className={`relative flex items-center gap-2.5 rounded-xl p-2 transition border ${
            isEmergencyMode
              ? "bg-white/90 border-rose-200"
              : "bg-white/70 hover:bg-white border-slate-200/60"
          }`}
        >
          <MapPin className="w-4 h-4 text-rose-600 shrink-0 ml-1" />
          <input
            type="text"
            value={destinationQuery}
            onChange={(e) => setDestinationQuery(e.target.value)}
            onFocus={() => setActiveInput("destination")}
            onKeyDown={handleKeyDown}
            placeholder="Choose destination or drop pin..."
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 font-semibold text-xs sm:text-sm"
          />
          {activeInput === "destination" && isSearching && (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          )}
          {destinationQuery && (
            <button
              onClick={() => {
                setDestinationQuery("");
                setSelectedDestination(null);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {activeInput && searchResults.length > 0 && (
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
