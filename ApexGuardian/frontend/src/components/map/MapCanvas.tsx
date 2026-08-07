"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigation, BENGALURU_CENTER } from "@/context/NavigationContext";
import { reverseGeocode } from "@/lib/api";

export const mapRefContainer: { current: maplibregl.Map | null } = { current: null };

export const BENGALURU_MAX_BOUNDS: maplibregl.LngLatBoundsLike = [
  [77.3500, 12.7000],
  [77.8500, 13.2500],
];

export const MapCanvas: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);

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
  } = useNavigation();

  // Initialize MapLibre GL with High-DPI Crisp Tile Specs & Spatial Bounds
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "carto-positron-hd": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
            ],
            tileSize: 512,
            zoomOffset: -1,
            maxzoom: 18,
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
          }
        },
        layers: [
          {
            id: "carto-positron-hd-layer",
            type: "raster",
            source: "carto-positron-hd",
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [BENGALURU_CENTER.lon, BENGALURU_CENTER.lat],
      zoom: 12.5,
      minZoom: 10,
      maxZoom: 18,
      maxBounds: BENGALURU_MAX_BOUNDS,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    });

    map.on("zoom", () => setCurrentZoom(map.getZoom()));
    map.on("zoomend", () => setCurrentZoom(map.getZoom()));

    mapRef.current = map;
    mapRefContainer.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      mapRefContainer.current = null;
    };
  }, [setCurrentZoom]);

  // ResizeObserver & Window Resize Handler
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

  // Map Click Listener for Pin Drop Modes with Reverse Geocoding
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
  }, [pinDropMode, selectedOrigin, selectedDestination, setSelectedOrigin, setSelectedDestination, setSourceQuery, setDestinationQuery, setPinDropMode, calculateRoutes]);

  // Update Draggable Source (Green) and Destination (Red) Markers with Reverse Geocoding
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Green Source Marker
    if (selectedOrigin) {
      if (!originMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "relative flex items-center justify-center w-6 h-6 cursor-grab active:cursor-grabbing";
        el.innerHTML = `
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
          <span className="relative inline-flex w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-md"></span>
        `;
        const marker = new maplibregl.Marker({ element: el, draggable: true })
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

    // Red Destination Marker
    if (selectedDestination) {
      if (!destMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-full hover:scale-110 transition duration-300";
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
  }, [selectedOrigin, selectedDestination, setSelectedOrigin, setSelectedDestination, setSourceQuery, setDestinationQuery, calculateRoutes]);

  // Clean Polyline Map Canvas Rendering (Case A: Dual Routes vs Case B: Single Route)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || routes.length === 0) return;

    const renderPolylines = () => {
      const hasAIRoute = routes.some((r) => r.is_ai_recommended && routes.length > 1);
      const standardRoute = routes.find((r) => !r.is_ai_recommended) || routes[0];
      const aiRoute = routes.find((r) => r.is_ai_recommended && routes.length > 1);

      const isStandardActive = routes[activeRouteIndex]?.route_index === standardRoute?.route_index && !routes[activeRouteIndex]?.is_ai_recommended;

      // 1. STANDARD ROUTE LAYER (Slate Grey #64748B)
      if (standardRoute && standardRoute.geometry) {
        if (map.getSource("source-standard")) {
          (map.getSource("source-standard") as maplibregl.GeoJSONSource).setData({
            type: "Feature",
            properties: { type: "standard" },
            geometry: standardRoute.geometry as any,
          });
        } else {
          map.addSource("source-standard", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: { type: "standard" },
              geometry: standardRoute.geometry as any,
            },
          });
        }

        const stdVis = (activeLayerMode === "AI_ONLY" && hasAIRoute) ? "none" : "visible";

        if (!map.getLayer("layer-standard-casing")) {
          map.addLayer({
            id: "layer-standard-casing",
            type: "line",
            source: "source-standard",
            layout: { "line-join": "round", "line-cap": "round", "visibility": stdVis },
            paint: {
              "line-color": "#334155",
              "line-width": isStandardActive ? 10 : 8,
              "line-opacity": isStandardActive ? 0.35 : 0.20,
              "line-offset": hasAIRoute ? -3.5 : 0,
            },
          });
        } else {
          map.setLayoutProperty("layer-standard-casing", "visibility", stdVis);
        }

        if (!map.getLayer("layer-standard")) {
          map.addLayer({
            id: "layer-standard",
            type: "line",
            source: "source-standard",
            layout: { "line-join": "round", "line-cap": "round", "visibility": stdVis },
            paint: {
              "line-color": isStandardActive ? "#3B82F6" : "#64748B",
              "line-width": isStandardActive ? 7 : 6,
              "line-opacity": isStandardActive ? 0.98 : 0.85,
              "line-offset": hasAIRoute ? -3.5 : 0,
            },
          });

          map.on("click", "layer-standard", () => {
            const stdIdx = routes.findIndex((r) => r.route_index === standardRoute.route_index);
            if (stdIdx !== -1) setActiveRouteIndex(stdIdx);
          });
          map.on("mouseenter", "layer-standard", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "layer-standard", () => {
            map.getCanvas().style.cursor = "";
          });
        } else {
          map.setLayoutProperty("layer-standard", "visibility", stdVis);
        }
      }

      // 2. AI RECOMMENDED BYPASS LAYER (Emerald Green #10B981) - Rendered ONLY if Case A (hasAIRoute === true)
      if (hasAIRoute && aiRoute && aiRoute.geometry) {
        if (map.getSource("source-ai")) {
          (map.getSource("source-ai") as maplibregl.GeoJSONSource).setData({
            type: "Feature",
            properties: { type: "ai" },
            geometry: aiRoute.geometry as any,
          });
        } else {
          map.addSource("source-ai", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: { type: "ai" },
              geometry: aiRoute.geometry as any,
            },
          });
        }

        const aiVis = (activeLayerMode === "STANDARD_ONLY") ? "none" : "visible";

        if (!map.getLayer("layer-ai-casing")) {
          map.addLayer({
            id: "layer-ai-casing",
            type: "line",
            source: "source-ai",
            layout: { "line-join": "round", "line-cap": "round", "visibility": aiVis },
            paint: {
              "line-color": "#047857",
              "line-width": isStandardActive ? 8 : 12,
              "line-opacity": isStandardActive ? 0.20 : 0.45,
              "line-offset": 0,
            },
          });
        } else {
          map.setLayoutProperty("layer-ai-casing", "visibility", aiVis);
        }

        if (!map.getLayer("layer-ai")) {
          map.addLayer({
            id: "layer-ai",
            type: "line",
            source: "source-ai",
            layout: { "line-join": "round", "line-cap": "round", "visibility": aiVis },
            paint: {
              "line-color": "#10B981",
              "line-width": isStandardActive ? 4 : 7,
              "line-opacity": isStandardActive ? 0.50 : 0.95,
              "line-offset": 0,
            },
          });

          map.on("click", "layer-ai", () => {
            const aiIdx = routes.findIndex((r) => r.route_index === aiRoute.route_index);
            if (aiIdx !== -1) setActiveRouteIndex(aiIdx);
          });
          map.on("mouseenter", "layer-ai", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "layer-ai", () => {
            map.getCanvas().style.cursor = "";
          });
        } else {
          map.setLayoutProperty("layer-ai", "visibility", aiVis);
        }
      } else {
        // Hide AI layer if Case B (Single Route)
        if (map.getLayer("layer-ai")) map.setLayoutProperty("layer-ai", "visibility", "none");
        if (map.getLayer("layer-ai-casing")) map.setLayoutProperty("layer-ai-casing", "visibility", "none");
      }

      // Fit bounds framing ALL candidate routes
      if (routes.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        routes.forEach((r) => {
          if (r.geometry && r.geometry.coordinates) {
            r.geometry.coordinates.forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
            });
          }
        });
        map.fitBounds(bounds, {
          padding: { top: 120, bottom: 200, left: 120, right: 120 },
          maxZoom: 15,
          duration: 1000,
        });
      }
    };

    if (map.isStyleLoaded()) {
      renderPolylines();
    } else {
      map.once("load", renderPolylines);
    }
  }, [routes, activeRouteIndex, setActiveRouteIndex, activeLayerMode]);

  // Handle re-center trigger
  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterTrigger === 0) return;

    if (selectedDestination) {
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
  }, [recenterTrigger, selectedDestination]);

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />;
};
