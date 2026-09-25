"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { TRAFFIC_COLORS } from "@/lib/trafficScenario";
import { useNavigation, BENGALURU_CENTER } from "@/context/NavigationContext";
import { reverseGeocode, CongestionHotspot } from "@/lib/api";
import { OVERLAY_Z } from "@/lib/layoutZones";

export const mapRefContainer: { current: maplibregl.Map | null } = { current: null };

export const BENGALURU_MAX_BOUNDS: maplibregl.LngLatBoundsLike = [
  [77.4000, 12.8000], // South-West
  [77.8000, 13.1500], // North-East
];

export const MapCanvas: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hotspotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const lastCameraFollowTimeRef = useRef<number>(0);

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
    isNavigating,
    currentLocation,
    vehicleBearing,
    activeRerouteRecommendation,
    navigationHudHeight,
  } = useNavigation();

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
      center: [BENGALURU_CENTER.lon, BENGALURU_CENTER.lat],
      zoom: 12.5,
      minZoom: 10,
      maxZoom: 19,
      maxBounds: BENGALURU_MAX_BOUNDS,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on("load", () => {
      map.resize();
    });

    map.on("zoom", () => setCurrentZoom(map.getZoom()));
    map.on("zoomend", () => setCurrentZoom(map.getZoom()));

    mapRef.current = map;
    mapRefContainer.current = map;

    const timer = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      mapRefContainer.current = null;
    };
  }, [setCurrentZoom]);

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

  // Update cursor based on pinDropMode
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = pinDropMode !== "none" ? "crosshair" : "";
    }
  }, [pinDropMode]);


  // Map Click Listener for Pin Drop
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = async (e: maplibregl.MapMouseEvent) => {
      if (pinDropMode === "none") return;

      const { lng, lat } = e.lngLat;
      const roundedLat = parseFloat(lat.toFixed(5));
      const roundedLon = parseFloat(lng.toFixed(5));

      let resolvedName = `Location (${roundedLat}, ${roundedLon})`;
      try {
        const rev = await reverseGeocode(roundedLat, roundedLon);
        if (rev && rev.display_name) resolvedName = rev.display_name;
      } catch (err) {
        console.error("Reverse geocode error:", err);
      }

      if (pinDropMode === "source") {
        const newOrigin = { lat: roundedLat, lon: roundedLon, name: resolvedName };
        setSelectedOrigin(newOrigin);
        setSourceQuery(resolvedName);
        setPinDropMode("none");
        if (selectedDestination) {
          await calculateRoutes(newOrigin, selectedDestination);
        }
      } else if (pinDropMode === "destination") {
        const newDest = { lat: roundedLat, lon: roundedLon, name: resolvedName };
        setSelectedDestination(newDest);
        setDestinationQuery(resolvedName);
        setPinDropMode("none");
        if (selectedOrigin) {
          await calculateRoutes(selectedOrigin, newDest);
        }
      }
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [
    pinDropMode,
    selectedOrigin,
    selectedDestination,
    setSelectedOrigin,
    setSelectedDestination,
    setSourceQuery,
    setDestinationQuery,
    setPinDropMode,
    calculateRoutes,
  ]);

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

        marker.on("dragend", async () => {
          const lngLat = marker.getLngLat();
          const roundedLat = parseFloat(lngLat.lat.toFixed(5));
          const roundedLon = parseFloat(lngLat.lng.toFixed(5));

          let resolvedName = `Location (${roundedLat}, ${roundedLon})`;
          try {
            const rev = await reverseGeocode(roundedLat, roundedLon);
            if (rev && rev.display_name) resolvedName = rev.display_name;
          } catch (err) {
            console.error("Reverse geocode drag error:", err);
          }

          const newOrigin = { lat: roundedLat, lon: roundedLon, name: resolvedName };
          setSelectedOrigin(newOrigin);
          setSourceQuery(resolvedName);
          if (selectedDestination) {
            await calculateRoutes(newOrigin, selectedDestination);
          }
        });

        originMarkerRef.current = marker;
      } else {
        originMarkerRef.current.setLngLat([selectedOrigin.lon, selectedOrigin.lat]);
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }
  }, [selectedOrigin, selectedDestination, setSelectedOrigin, setSourceQuery, calculateRoutes]);

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

        marker.on("dragend", async () => {
          const lngLat = marker.getLngLat();
          const roundedLat = parseFloat(lngLat.lat.toFixed(5));
          const roundedLon = parseFloat(lngLat.lng.toFixed(5));

          let resolvedName = `Location (${roundedLat}, ${roundedLon})`;
          try {
            const rev = await reverseGeocode(roundedLat, roundedLon);
            if (rev && rev.display_name) resolvedName = rev.display_name;
          } catch (err) {
            console.error("Reverse geocode drag error:", err);
          }

          const newDest = { lat: roundedLat, lon: roundedLon, name: resolvedName };
          setSelectedDestination(newDest);
          setDestinationQuery(resolvedName);
          if (selectedOrigin) {
            await calculateRoutes(selectedOrigin, newDest);
          }
        });

        destMarkerRef.current = marker;
      } else {
        destMarkerRef.current.setLngLat([selectedDestination.lon, selectedDestination.lat]);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [selectedDestination, selectedOrigin, setSelectedDestination, setDestinationQuery, calculateRoutes]);

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

      sortedIndices.forEach((idx) => {
        const route = routes[idx];
        if (!route || !route.geometry) return;

        const isSelected = idx === activeRouteIndex;
        const isAI = Boolean(route.is_ai_recommended);

        // Layer Mode Filtering
        if (activeLayerMode === "AI_ONLY" && !isAI && routes.length > 1) return;
        if (activeLayerMode === "STANDARD_ONLY" && isAI && routes.length > 1) return;

        if (route.segments && route.segments.length > 0) {
          // Render Segmented Color-Coded Polyline for All Routes
          route.segments.forEach((seg, sIdx) => {
            const sourceId = `seg-source-${idx}-${sIdx}`;
            const casingLayerId = `seg-casing-${idx}-${sIdx}`;
            const lineLayerId = `seg-line-${idx}-${sIdx}`;

            const trafficColor = TRAFFIC_COLORS[seg.congestion_level] || seg.color;
            const segmentColor = isSelected ? trafficColor : "#94A3B8";

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
                "line-color": isSelected ? "#2563EB" : "#1E293B",
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
            if (!isSelected) {
              const clickListener = () => {
                if (!isNavigating) {
                  setActiveRouteIndex(idx);
                }
              };
              map.on("click", lineLayerId, clickListener);
              renderedListenersRef.current.push({ layerId: lineLayerId, listener: clickListener });
            }
          });

          // Section 3: Render Distinct Congestion Drop Pins Anchored Directly at Hotspot GPS Points
          if (route.hotspots && route.hotspots.length > 0) {
            route.hotspots.forEach((hotspot) => {
              const el = document.createElement("div");
              const level = hotspot.congestion_level || "HEAVY";
              const isSevere = level === "SEVERE";
              const isModerate = level === "MODERATE";
              const levelColor = TRAFFIC_COLORS[level];
              const isHeavy = level === "HEAVY";
              const accessibleLabel = `${level[0]}${level.slice(1).toLowerCase()} traffic ahead at ${hotspot.location_name}`;

              let pinFill = "#DC2626"; // Red (Heavy)
              let pinStroke = "#F87171";
              let shadowColor = "rgba(220, 38, 38, 0.4)";
              let iconSvg = "";
              let titleColor = "text-rose-400";
              let badgeBg = "bg-rose-600 text-white";

              if (isModerate) {
                pinFill = "#D97706"; // Amber (Moderate)
                pinStroke = "#FBBF24";
                shadowColor = "rgba(217, 119, 6, 0.35)";
                titleColor = "text-amber-400";
                badgeBg = "bg-amber-600 text-white";
                // Shape: Single vehicle silhouette
                iconSvg = `
                  <path d="M22 13H14c-.5 0-.9.3-1.1.7L11.5 16v4.5c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-.7h8.8v.7c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7V16l-1.4-2.3c-.2-.4-.6-.7-1.1-.7zm-7.7.7h7.4l.7 1.8h-8.8l.7-1.8zm7.7 5.3c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm-8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z" fill="#D97706"/>
                `;
              } else if (isSevere) {
                pinFill = "#991B1B"; // Crimson Maroon (Severe)
                pinStroke = "#E11D48";
                shadowColor = "rgba(225, 29, 72, 0.6)";
                titleColor = "text-rose-400";
                badgeBg = "bg-rose-700 text-white ring-1 ring-rose-400";
                // Shape: Queued vehicles + warning badge (!)
                iconSvg = `
                  <path d="M19 10h-4c-.3 0-.5.2-.6.4L13.5 12h7l-.7-1.6c-.1-.2-.4-.4-.8-.4z" fill="#991B1B" opacity="0.6"/>
                  <path d="M22 13.5H14c-.5 0-.9.3-1.1.7L11.5 16.5V21c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-.7h8.8v.7c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-4.5l-1.4-2.3c-.2-.4-.6-.7-1.1-.7zm-7.7.7h7.4l.7 1.8h-8.8l.7-1.8zm7.7 5.3c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm-8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z" fill="#991B1B"/>
                  <circle cx="28" cy="8" r="5.5" fill="#FBBF24" stroke="#78350F" stroke-width="1"/>
                  <path d="M28 5v4M28 10v1" stroke="#991B1B" stroke-width="1.5" stroke-linecap="round"/>
                `;
              } else {
                // Shape: Group of 3 vehicles
                iconSvg = `
                  <path d="M15 13H11c-.3 0-.5.2-.6.4l-1.4 1.8V18c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-.5h6v.5c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-2.8l-1.4-1.8c-.1-.2-.3-.4-.6-.4zm-4.1.5h4.2l.4 1.2h-5l.4-1.2zm4.1 3c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm-4 0c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5z" fill="#DC2626" opacity="0.5"/>
                  <path d="M26 13h-4c-.3 0-.5.2-.6.4L20 15.2V18c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-.5h6v.5c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-2.8l-1.4-1.8c-.1-.2-.3-.4-.6-.4zm-4.1.5h4.2l.4 1.2h-5l.4-1.2zm4.1 3c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm-4 0c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5z" fill="#DC2626" opacity="0.5"/>
                  <path d="M22 17.5h-8c-.5 0-.9.3-1.1.7L11.5 20.5V25c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-.7h8.8v.7c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-4.5l-1.4-2.3c-.2-.4-.6-.7-1.1-.7zm-7.7.7h7.4l.7 1.8h-8.8l.7-1.8zm7.7 5.3c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm-8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z" fill="#DC2626"/>
                `;
              }
              // Opacity for non-selected route pins
              if (!isSelected) {
                el.style.opacity = "0.5";
                el.style.pointerEvents = "none";
              } else {
                el.style.opacity = "1";
              }

              el.className = "relative cursor-pointer group";
              el.setAttribute("role", "img");
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
                  <div class="p-2.5 rounded-xl bg-slate-900/95 text-white text-xs space-y-1 shadow-2xl border border-slate-700 min-w-[170px] backdrop-blur-md">
                    <div class="font-extrabold text-xs flex items-center gap-1.5" style="color:${levelColor}">
                      <span>${accessibleLabel}</span>
                    </div>
                    <div class="flex items-center justify-between text-slate-300 text-[11px]">
                      <span>Average Speed:</span>
                      <span class="font-bold text-amber-300">${hotspot.average_speed_kmh} km/h</span>
                    </div>
                    <div class="text-[10px] text-slate-400 font-medium pt-0.5">
                      ${hotspot.description || hotspot.cause || "Traffic congestion bottleneck"}
                    </div>
                  </div>
                `;

                const popup = new maplibregl.Popup({
                  offset: [0, -46],
                  closeButton: false,
                  className: "custom-hotspot-popup",
                }).setHTML(popupContent);

                const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                  .setLngLat([hotspot.lon, hotspot.lat])
                  .setPopup(popup)
                  .addTo(map);

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
                "line-color": isSelected ? "#2563EB" : "#1E293B",
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
              "line-color": isSelected ? (isEmergencyMode ? "#EF4444" : "#3B82F6") : "#64748B",
              "line-width": isSelected ? 7 : 5,
              "line-opacity": isSelected ? 1.0 : 0.65,
            },
          });
          renderedLayersRef.current.push(lineLayerId);

          if (!isSelected) {
            const clickListener = () => {
              if (!isNavigating) {
                setActiveRouteIndex(idx);
              }
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
            "line-color": "#10B981",
            "line-width": 6,
            "line-dasharray": [2, 2],
            "line-opacity": 0.9,
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
        center: [BENGALURU_CENTER.lon, BENGALURU_CENTER.lat],
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
        <div className="absolute top-6 left-3 right-3 mx-auto w-fit max-w-[calc(100%-1.5rem)] bg-slate-900/90 text-white px-6 py-3 rounded-full shadow-2xl border border-blue-500/50 backdrop-blur-md animate-pulse" style={{ zIndex: OVERLAY_Z.mapPrompt }}>
          <p className="text-sm font-bold tracking-wide text-center">
            Tap the map to set your <span className="text-blue-400">{pinDropMode === "source" ? "starting" : "destination"}</span> point
          </p>
        </div>
      )}
    </div>
  );
};
