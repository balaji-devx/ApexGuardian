"use client";

import React, { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { TRAFFIC_COLORS } from "@/lib/trafficScenario";
import { useNavigation, haversineMeters } from "@/context/NavigationContext";
import { ACTIVE_REGION_CENTER, ACTIVE_REGION_CONFIG } from "@/lib/region";
import { reverseGeocode, CongestionHotspot } from "@/lib/api";
import { OVERLAY_Z } from "@/lib/layoutZones";

// Route identity colours (used only where traffic is clear; congestion keeps its own colours).
const AI_ROUTE_GREEN = "#16A34A";      // AI recommended route
const AI_ROUTE_GREEN_DARK = "#15803D";
const OSRM_ROUTE_BLUE = "#2563EB";     // OSRM preferred / second-best route
const OSRM_ROUTE_BLUE_DARK = "#1D4ED8";

const escapePopupText = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, (character) => {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return entities[character] ?? character;
});

export const mapRefContainer: { current: maplibregl.Map | null } = { current: null };

export const MapCanvas: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hotspotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const lastCameraFollowTimeRef = useRef<number>(0);
  const lastClickTimestampRef = useRef<number>(0);

  const {
    selectedOrigin,
    setSelectedOrigin,
    setSourceQuery,
    selectedDestination,
    setSelectedDestination,
    setDestinationQuery,
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    recenterTrigger,
    setCurrentZoom,
    pinDropMode,
    setPinDropMode,
    calculateRoutes,
    activeLayerMode,
    isEmergencyMode,
    trafficTestMode,
    isNavigating,
    currentLocation,
    vehicleBearing,
    activeRerouteRecommendation,
    navigationHudHeight,
  } = useNavigation();

  // Stable refs for values used inside event handlers.
  // This lets us register map listeners ONCE and always read the latest state.
  const pinDropModeRef = useRef(pinDropMode);
  const selectedOriginRef = useRef(selectedOrigin);
  const selectedDestinationRef = useRef(selectedDestination);
  const calculateRoutesRef = useRef(calculateRoutes);
  const setSelectedOriginRef = useRef(setSelectedOrigin);
  const setSelectedDestinationRef = useRef(setSelectedDestination);
  const setSourceQueryRef = useRef(setSourceQuery);
  const setDestinationQueryRef = useRef(setDestinationQuery);
  const setPinDropModeRef = useRef(setPinDropMode);
  const isNavigatingRef = useRef(isNavigating);
  const activeRouteIndexRef = useRef(activeRouteIndex);

  // Keep refs in sync with latest values on every render (no effects needed).
  pinDropModeRef.current = pinDropMode;
  selectedOriginRef.current = selectedOrigin;
  selectedDestinationRef.current = selectedDestination;
  calculateRoutesRef.current = calculateRoutes;
  setSelectedOriginRef.current = setSelectedOrigin;
  setSelectedDestinationRef.current = setSelectedDestination;
  setSourceQueryRef.current = setSourceQuery;
  setDestinationQueryRef.current = setDestinationQuery;
  setPinDropModeRef.current = setPinDropMode;
  isNavigatingRef.current = isNavigating;
  activeRouteIndexRef.current = activeRouteIndex;

  // Map Click Listener for Destination and Origin Selection — stable callback that reads from refs.
  // Defined before the map init effect so it can be passed to map.on() during initialization.
  const stableHandleMapClick = useCallback((e: maplibregl.MapMouseEvent) => {
    // If actively driving/navigating, do not permit map click destination changes
    if (isNavigatingRef.current) return;

    // Ignore clicks directly on map markers, popups, or controls
    const origTarget = e.originalEvent?.target as HTMLElement | null;
    if (origTarget && (
      origTarget.closest(".maplibregl-marker") ||
      origTarget.closest(".maplibregl-popup") ||
      origTarget.closest(".maplibregl-ctrl")
    )) {
      return;
    }

    // Map clicks only place a pin when the user explicitly enabled a drop mode.
    // Otherwise the click is reserved for route-line selection (OSRM vs AI route).
    const currentMode = pinDropModeRef.current;
    if (currentMode === "none") return;

    // Debounce rapid double-clicks to prevent duplicate pin / route requests.
    const now = Date.now();
    if (now - lastClickTimestampRef.current < 300) {
      return;
    }
    lastClickTimestampRef.current = now;

    const { lng, lat } = e.lngLat;
    const roundedLat = parseFloat(lat.toFixed(5));
    const roundedLon = parseFloat(lng.toFixed(5));

    // The explicit button determines the target. After one pin is placed the mode
    // returns to "none", so another map click cannot silently replace the destination.
    const targetMode: "source" | "destination" = currentMode;

    const initialName = `Location (${roundedLat}, ${roundedLon})`;

    if (targetMode === "source") {
      const newOrigin = { lat: roundedLat, lon: roundedLon, name: initialName };
      setSelectedOriginRef.current(newOrigin);
      setSourceQueryRef.current(initialName);
      if (currentMode !== "none") {
        setPinDropModeRef.current("none");
      }
      if (selectedDestinationRef.current) {
        void calculateRoutesRef.current(newOrigin, selectedDestinationRef.current);
      }
      reverseGeocode(roundedLat, roundedLon).then((rev) => {
        if (rev?.display_name) {
          const resolvedName = rev.display_name;
          setSelectedOriginRef.current({ lat: roundedLat, lon: roundedLon, name: resolvedName });
          setSourceQueryRef.current(resolvedName);
        }
      }).catch((err) => {
        console.warn("[MapCanvas] Reverse geocode background warning:", err);
      });
    } else {
      const newDest = { lat: roundedLat, lon: roundedLon, name: initialName };
      setSelectedDestinationRef.current(newDest);
      setDestinationQueryRef.current(initialName);
      if (currentMode !== "none") {
        setPinDropModeRef.current("none");
      }
      if (selectedOriginRef.current) {
        void calculateRoutesRef.current(selectedOriginRef.current, newDest);
      }
      reverseGeocode(roundedLat, roundedLon).then((rev) => {
        if (rev?.display_name) {
          const resolvedName = rev.display_name;
          setSelectedDestinationRef.current({ lat: roundedLat, lon: roundedLon, name: resolvedName });
          setDestinationQueryRef.current(resolvedName);
        }
      }).catch((err) => {
        console.warn("[MapCanvas] Reverse geocode background warning:", err);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — reads from refs

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "carto-positron-hd": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "carto-positron-hd-layer",
            type: "raster",
            source: "carto-positron-hd",
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: [ACTIVE_REGION_CENTER.lon, ACTIVE_REGION_CENTER.lat],
      zoom: ACTIVE_REGION_CONFIG.defaultZoom,
      minZoom: 3,
      maxZoom: 19,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on("load", () => {
      map.resize();
    });

    map.on("zoom", () => setCurrentZoom(map.getZoom()));
    map.on("zoomend", () => setCurrentZoom(map.getZoom()));

    // Register the stable click handler here — guaranteed map exists, and it
    // persists for the full lifetime of this map instance.
    map.on("click", stableHandleMapClick);

    mapRef.current = map;
    mapRefContainer.current = map;

    const timer = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.off("click", stableHandleMapClick);
      map.remove();
      mapRef.current = null;
      mapRefContainer.current = null;
    };
  }, [setCurrentZoom, stableHandleMapClick]);

  // Window Resize Listener
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapContainerRef.current) return;

    const handleResize = () => {
      if (mapRef.current) mapRef.current.resize();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mapContainerRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Disable double-click zoom while pin drop mode is active so double clicks don't zoom instead of placing pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pinDropMode !== "none") {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [pinDropMode]);

  // Update cursor based on pinDropMode
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = pinDropMode !== "none" ? "crosshair" : "";
    }
  }, [pinDropMode]);

  // Origin Marker (Section 5: Matching Drop-Pin Style in Emerald Green)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedOrigin) {
      if (!originMarkerRef.current) {
        const el = document.createElement("div");
        el.className =
          "cursor-grab active:cursor-grabbing hover:scale-110 transition duration-300";
        el.innerHTML = `
          <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.163 24.837 0 16 0ZM16 22C12.686 22 10 19.314 10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16C22 19.314 19.314 22 16 22Z" fill="#10B981"/>
            <path d="M16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20Z" fill="#047857"/>
          </svg>
        `;
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: true })
          .setLngLat([selectedOrigin.lon, selectedOrigin.lat])
          .addTo(map);

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          const roundedLat = parseFloat(lngLat.lat.toFixed(5));
          const roundedLon = parseFloat(lngLat.lng.toFixed(5));
          const initialName = `Location (${roundedLat}, ${roundedLon})`;

          const newOrigin = { lat: roundedLat, lon: roundedLon, name: initialName };
          setSelectedOriginRef.current(newOrigin);
          setSourceQueryRef.current(initialName);
          if (selectedDestinationRef.current) {
            void calculateRoutesRef.current(newOrigin, selectedDestinationRef.current);
          }

          reverseGeocode(roundedLat, roundedLon).then((rev) => {
            if (rev?.display_name) {
              const resolvedName = rev.display_name;
              setSelectedOriginRef.current({ lat: roundedLat, lon: roundedLon, name: resolvedName });
              setSourceQueryRef.current(resolvedName);
            }
          }).catch((err) => {
            console.warn("[MapCanvas] Reverse geocode drag error:", err);
          });
        });

        originMarkerRef.current = marker;
      } else {
        originMarkerRef.current.setLngLat([selectedOrigin.lon, selectedOrigin.lat]);
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }
  }, [selectedOrigin]);

  // Destination Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedDestination) {
      if (!destMarkerRef.current) {
        const el = document.createElement("div");
        el.className =
          "cursor-grab active:cursor-grabbing hover:scale-110 transition duration-300";
        el.innerHTML = `
          <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.163 24.837 0 16 0ZM16 22C12.686 22 10 19.314 10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16C22 19.314 19.314 22 16 22Z" fill="#EA4335"/>
            <path d="M16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20Z" fill="#7A0000"/>
          </svg>
        `;
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: true })
          .setLngLat([selectedDestination.lon, selectedDestination.lat])
          .addTo(map);

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          const roundedLat = parseFloat(lngLat.lat.toFixed(5));
          const roundedLon = parseFloat(lngLat.lng.toFixed(5));
          const initialName = `Location (${roundedLat}, ${roundedLon})`;

          const newDest = { lat: roundedLat, lon: roundedLon, name: initialName };
          setSelectedDestinationRef.current(newDest);
          setDestinationQueryRef.current(initialName);
          if (selectedOriginRef.current) {
            void calculateRoutesRef.current(selectedOriginRef.current, newDest);
          }

          reverseGeocode(roundedLat, roundedLon).then((rev) => {
            if (rev?.display_name) {
              const resolvedName = rev.display_name;
              setSelectedDestinationRef.current({ lat: roundedLat, lon: roundedLon, name: resolvedName });
              setDestinationQueryRef.current(resolvedName);
            }
          }).catch((err) => {
            console.warn("[MapCanvas] Reverse geocode drag error:", err);
          });
        });

        destMarkerRef.current = marker;
      } else {
        destMarkerRef.current.setLngLat([selectedDestination.lon, selectedDestination.lat]);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [selectedDestination]);

  // Smooth Vehicle Marker & Camera Follow (Section 4)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isNavigating && currentLocation) {
      if (!vehicleMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "relative flex items-center justify-center pointer-events-none";
        el.style.width = "42px";
        el.style.height = "42px";
        el.innerHTML = `
          <div class="absolute w-10 h-10 rounded-full bg-blue-500/25 animate-ping"></div>
          <div class="vehicle-inner relative w-9 h-9 rounded-full bg-slate-900 border-2 border-white shadow-2xl flex items-center justify-center transition-transform duration-75 ease-out">
            <svg class="w-5 h-5 text-blue-400 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
            </svg>
          </div>
        `;

        vehicleMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([currentLocation.lon, currentLocation.lat])
          .addTo(map);
      } else {
        // Smooth fractional position updates
        vehicleMarkerRef.current.setLngLat([currentLocation.lon, currentLocation.lat]);
        const innerIcon = vehicleMarkerRef.current.getElement().querySelector(".vehicle-inner") as HTMLElement;
        if (innerIcon) {
          innerIcon.style.transform = `rotate(${vehicleBearing}deg)`;
        }
      }

      // Smooth camera follow without competing with marker animation
      const now = performance.now();
      if (now - lastCameraFollowTimeRef.current > 200) {
        lastCameraFollowTimeRef.current = now;
        map.easeTo({
          center: [currentLocation.lon, currentLocation.lat],
          duration: 250,
          easing: (t) => t,
          zoom: Math.max(14.5, map.getZoom()),
          padding: {
            top: 0,
            bottom: isNavigating ? navigationHudHeight : 0,
            left: 0,
            right: 0,
          },
        });
      }
    } else if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
    }
  }, [isNavigating, currentLocation, vehicleBearing, navigationHudHeight]);

  // Render Multi-Color Congestion Segments & Congestion Drop Pins (Sections 3 & 6)
  const renderedLayersRef = useRef<string[]>([]);
  const renderedSourcesRef = useRef<string[]>([]);
  const renderedListenersRef = useRef<{ layerId: string; listener: any }[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const cleanupOldRoutes = () => {
      renderedLayersRef.current.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      });
      renderedLayersRef.current = [];

      renderedSourcesRef.current.forEach((sourceId) => {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      });
      renderedSourcesRef.current = [];

      renderedListenersRef.current.forEach(({ layerId, listener }) => {
        map.off("click", layerId, listener);
      });
      renderedListenersRef.current = [];

      // Clear all hotspot drop pin markers
      hotspotMarkersRef.current.forEach((m) => m.remove());
      hotspotMarkersRef.current = [];
    };

    const renderPolylines = () => {
      cleanupOldRoutes();
      if (!routes || routes.length === 0) return;

      // Draw non-active routes first, then active route on top
      const sortedIndices = routes.map((_, idx) => idx).sort((a, b) => {
        if (a === activeRouteIndex) return 1;
        if (b === activeRouteIndex) return -1;
        return 0;
      });

      const renderedHotspotIds = new Set<string>();

      sortedIndices.forEach((idx) => {
        const route = routes[idx];
        if (!route || !route.geometry) return;

        const isSelected = idx === activeRouteIndex;
        const isAI = Boolean(route.is_ai_recommended);
        // The currently selected/active route is always green, regardless of whether its
        // original source was AI or OSRM. Unselected OSRM alternatives remain blue.
        const clearColor = isSelected || isAI ? AI_ROUTE_GREEN : OSRM_ROUTE_BLUE;
        const clearCasing = isSelected || isAI ? AI_ROUTE_GREEN_DARK : OSRM_ROUTE_BLUE_DARK;

        // Layer Mode Filtering
        if (activeLayerMode === "AI_ONLY" && !isAI && routes.length > 1) return;
        if (activeLayerMode === "STANDARD_ONLY" && isAI && routes.length > 1) return;

        if (route.segments && route.segments.length > 0) {
          // Render Segmented Color-Coded Polyline for All Routes
          route.segments.forEach((seg, sIdx) => {
            const sourceId = `seg-source-${idx}-${sIdx}`;
            const casingLayerId = `seg-casing-${idx}-${sIdx}`;
            const lineLayerId = `seg-line-${idx}-${sIdx}`;

            // PATCH: clear stretches take the route's identity colour (AI = green, OSRM = blue);
            // congested stretches always keep their own yellow / orange / red. Unselected = grey.
            const level = seg.congestion_level;
            const isCongested = Boolean(level) && level !== "LOW";
            const trafficColor = isCongested
              ? (TRAFFIC_COLORS[level] || seg.color)
              : clearColor;
            const segmentColor = isSelected ? trafficColor : "#94A3B8";
            const segmentCasing = isSelected
              ? (isCongested ? trafficColor : clearCasing)
              : "#1E293B";

            map.addSource(sourceId, {
              type: "geojson",
              data: {
                type: "Feature",
                properties: { level: seg.congestion_level, color: segmentColor, routeIndex: idx },
                geometry: {
                  type: "LineString",
                  coordinates: seg.coordinates,
                },
              },
            });
            renderedSourcesRef.current.push(sourceId);

            // Casing Glow
            map.addLayer({
              id: casingLayerId,
              type: "line",
              source: sourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": segmentCasing,
                "line-width": isSelected ? 12 : 8,
                "line-opacity": isSelected ? 0.9 : 0.2,
              },
            });
            renderedLayersRef.current.push(casingLayerId);

            // Segment Line
            map.addLayer({
              id: lineLayerId,
              type: "line",
              source: sourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": segmentColor,
                "line-width": isSelected ? 7 : 5,
                "line-opacity": isSelected ? 1.0 : 0.65,
              },
            });
            renderedLayersRef.current.push(lineLayerId);

            // Click-to-switch behavior
            if (!isSelected && !isNavigating) {
              const clickListener = () => {
                if (pinDropModeRef.current !== "none") return;
                setActiveRouteIndex(idx);
              };
              map.on("click", lineLayerId, clickListener);
              renderedListenersRef.current.push({ layerId: lineLayerId, listener: clickListener });
            }
          });

          // Section 3: Render Distinct Congestion Drop Pins Anchored Directly at Hotspot GPS Points
          if (route.hotspots && route.hotspots.length > 0) {
            route.hotspots.forEach((hotspot) => {
              const locId = `${hotspot.lat.toFixed(3)}_${hotspot.lon.toFixed(3)}`;
              // Routes are drawn inactive-first, so otherwise an inactive marker can be
              // deduplicated here and suppress the active route's clickable popup.
              const activeRouteHasSameHotspot = !isSelected && (routes[activeRouteIndex]?.hotspots || []).some(
                (activeHotspot) => `${activeHotspot.lat.toFixed(3)}_${activeHotspot.lon.toFixed(3)}` === locId,
              );
              if (activeRouteHasSameHotspot || renderedHotspotIds.has(locId)) return;
              renderedHotspotIds.add(locId);

              // Skip a pin that is essentially co-located with the vehicle.
              // At this proximity the AdvanceAlertBanner already carries the
              // warning, and drawing a second marker here just stacks a
              // hazard pin directly on top of the vehicle marker — most
              // visible right at trip start, or right after a reroute
              // activates near a hotspot that sits close to the new route's
              // beginning.
              if (isSelected && isNavigating && currentLocation) {
                const distToVehicleM = haversineMeters(
                  currentLocation.lon, currentLocation.lat, hotspot.lon, hotspot.lat
                );
                if (distToVehicleM < 120) return;
              }

              const el = document.createElement("div");
              const level = hotspot.congestion_level || "HEAVY";
              const isSevere = level === "SEVERE";
              const levelColor = TRAFFIC_COLORS[level];
              const accessibleLabel = `${level[0]}${level.slice(1).toLowerCase()} traffic ahead at ${hotspot.location_name}`;

              // Opacity for non-selected route pins
              if (!isSelected) {
                el.style.opacity = "0.5";
                el.style.pointerEvents = "none";
              } else {
                el.style.opacity = "1";
              }

              el.className = "relative cursor-pointer group";
              el.setAttribute("role", "button");
              el.tabIndex = isSelected ? 0 : -1;
              el.setAttribute("aria-label", accessibleLabel);
              el.setAttribute("title", accessibleLabel);
              el.style.width = "44px";
              el.style.height = "44px";
              el.innerHTML = `
                <div class="relative flex items-center justify-center hover:scale-110 active:scale-95 transition duration-200" style="filter: drop-shadow(0 3px 8px ${levelColor}99);">
                  ${isSevere && isSelected ? `<span class="absolute w-10 h-10 rounded-full animate-ping pointer-events-none" style="background:${levelColor}55"></span>` : ""}
                  <svg width="44" height="44" viewBox="0 0 36 36" role="presentation" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="18" cy="18" r="16" fill="${levelColor}" stroke="white" stroke-width="2"/>
                    <path d="M18 8.5 28 26H8L18 8.5Z" fill="white" stroke="#1F2937" stroke-width="1.2" stroke-linejoin="round"/>
                    <path d="M18 14v5" stroke="#111827" stroke-width="2.4" stroke-linecap="round"/>
                    <circle cx="18" cy="22.2" r="1.2" fill="#111827"/>
                  </svg>
                </div>
              `;

              // Interactive Popup on Click / Hover (only if selected)
              if (isSelected) {
                const popupContent = `
                  <div class="p-3 rounded-xl bg-slate-900/95 text-white text-xs space-y-1.5 shadow-2xl border border-slate-700 min-w-[190px] backdrop-blur-md">
                    <div class="font-extrabold text-xs" style="color:${levelColor}">
                      ${escapePopupText(accessibleLabel)}
                    </div>
                    <div class="flex items-center justify-between text-slate-300 text-[11px]">
                      <span>Average speed</span>
                      <span class="font-bold text-amber-300">${escapePopupText(hotspot.average_speed_kmh)} km/h</span>
                    </div>
                    <div class="flex items-center justify-between text-slate-300 text-[11px]">
                      <span>Estimated delay</span>
                      <span class="font-bold text-rose-300">${Math.max(0, Math.round((hotspot.estimated_delay_seconds || 0) / 60))} min</span>
                    </div>
                    <div class="text-[11px] text-slate-300 font-medium pt-1 border-t border-slate-700">
                      ${escapePopupText(hotspot.description || hotspot.cause || "Traffic congestion bottleneck")}
                    </div>
                  </div>
                `;

                const popup = new maplibregl.Popup({
                  offset: [0, -46],
                  closeButton: true,
                  closeOnClick: false,
                  className: "custom-hotspot-popup",
                }).setHTML(popupContent);

                const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                  .setLngLat([hotspot.lon, hotspot.lat])
                  .setPopup(popup)
                  .addTo(map);
                el.addEventListener("keydown", (event: KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    marker.togglePopup();
                  }
                });

                hotspotMarkersRef.current.push(marker);
              } else {
                const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                  .setLngLat([hotspot.lon, hotspot.lat])
                  .addTo(map);
                hotspotMarkersRef.current.push(marker);
              }
            });
          }
        } else {
          // Fallback if no segments data (should not happen, but safe)
          const sourceId = `route-source-${idx}`;
          const casingLayerId = `route-casing-${idx}`;
          const lineLayerId = `route-line-${idx}`;

          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: { routeIndex: idx },
              geometry: route.geometry as any,
            },
          });
          renderedSourcesRef.current.push(sourceId);

          map.addLayer({
            id: casingLayerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": isSelected ? clearCasing : "#1E293B",
                "line-width": isSelected ? 12 : 8,
                "line-opacity": isSelected ? 0.9 : 0.2,
            },
          });
          renderedLayersRef.current.push(casingLayerId);

          map.addLayer({
            id: lineLayerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              // EMERGENCY FEATURE DISABLED: "line-color": isSelected ? (isEmergencyMode ? "#EF4444" : "#3B82F6") : "#64748B",
              "line-color": isSelected ? clearColor : "#64748B",
              "line-width": isSelected ? 7 : 5,
              "line-opacity": isSelected ? 1.0 : 0.65,
            },
          });
          renderedLayersRef.current.push(lineLayerId);

          if (!isSelected && !isNavigating) {
            const clickListener = () => {
              if (pinDropModeRef.current !== "none") return;
              setActiveRouteIndex(idx);
            };
            map.on("click", lineLayerId, clickListener);
            renderedListenersRef.current.push({ layerId: lineLayerId, listener: clickListener });
          }
        }
      });

      // Render Ghost Reroute Line if active (Features 8 & 9)
      if (activeRerouteRecommendation?.recommended_route?.geometry) {
        const rerouteSourceId = "ghost-reroute-source";
        const rerouteLineId = "ghost-reroute-line";

        map.addSource(rerouteSourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: activeRerouteRecommendation.recommended_route.geometry as any,
          },
        });
        renderedSourcesRef.current.push(rerouteSourceId);

        map.addLayer({
          id: rerouteLineId,
          type: "line",
          source: rerouteSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            // Once an alternate route is recommended, show it with the same green
            // active-route color as the committed navigation path.
            "line-color": AI_ROUTE_GREEN,
            "line-width": 7,
            "line-opacity": 0.9,
            "line-offset": 4,
          },
        });
        renderedLayersRef.current.push(rerouteLineId);
      }

      // Auto-fit bounds when not actively driving
      if (!isNavigating) {
        const bounds = new maplibregl.LngLatBounds();
        let hasPoints = false;
        routes.forEach((r) => {
          if (r.geometry && r.geometry.coordinates) {
            r.geometry.coordinates.forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
              hasPoints = true;
            });
          }
        });

        if (hasPoints) {
          map.fitBounds(bounds, {
            padding: { top: 100, bottom: 180, left: 100, right: 100 },
            maxZoom: 15,
            duration: 800,
          });
        }
      }
    };

    if (map.isStyleLoaded()) {
      renderPolylines();
    } else {
      map.once("load", renderPolylines);
    }
  }, [
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    activeLayerMode,
    isEmergencyMode,
    trafficTestMode,
    isNavigating,
    activeRerouteRecommendation,
  ]);

  // Recenter trigger
  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterTrigger === 0) return;

    if (currentLocation) {
      map.flyTo({
        center: [currentLocation.lon, currentLocation.lat],
        zoom: 15,
        duration: 1200,
      });
    } else if (selectedDestination) {
      map.flyTo({
        center: [selectedDestination.lon, selectedDestination.lat],
        zoom: 14,
        duration: 1200,
      });
    } else {
      map.flyTo({
        center: [ACTIVE_REGION_CENTER.lon, ACTIVE_REGION_CENTER.lat],
        zoom: 12.5,
        duration: 1200,
      });
    }
  }, [recenterTrigger, selectedDestination, currentLocation]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <div
        ref={mapContainerRef}
        className="pointer-events-auto"
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
      />
      {pinDropMode !== "none" && (
        <div className="absolute top-6 left-3 right-3 mx-auto w-fit max-w-[calc(100%-1.5rem)] bg-slate-900/90 text-white px-6 py-3 rounded-full shadow-2xl border border-blue-500/50 backdrop-blur-md animate-pulse pointer-events-none" style={{ zIndex: OVERLAY_Z.mapPrompt }}>
          <p className="text-sm font-bold tracking-wide text-center">
            Tap the map to set your <span className="text-blue-400">{pinDropMode === "source" ? "starting" : "destination"}</span> point
          </p>
        </div>
      )}
    </div>
  );
};