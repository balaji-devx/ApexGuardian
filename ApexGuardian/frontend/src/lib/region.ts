export type RegionId = "bengaluru" | "coimbatore";

export interface RegionCoordinate {
  lat: number;
  lon: number;
  name: string;
}

export interface RegionConfig {
  id: RegionId;
  displayName: string;
  center: RegionCoordinate;
  defaultOrigin: RegionCoordinate;
  testOrigin: RegionCoordinate;
  testDestination: RegionCoordinate;
  mapBounds: [[number, number], [number, number]];
  defaultZoom: number;
}

export const REGION_CONFIGS: Record<RegionId, RegionConfig> = {
  "bengaluru": {
    "id": "bengaluru",
    "displayName": "Bengaluru",
    "center": {
      "lat": 12.9716,
      "lon": 77.5946,
      "name": "Bengaluru Center"
    },
    "defaultOrigin": {
      "lat": 12.9786,
      "lon": 77.6421,
      "name": "Indiranagar, Bengaluru"
    },
    "testOrigin": {
      "lat": 12.9786,
      "lon": 77.6421,
      "name": "Indiranagar, Bengaluru"
    },
    "testDestination": {
      "lat": 12.9569,
      "lon": 77.7011,
      "name": "Marathahalli, Bengaluru"
    },
    "mapBounds": [
      [
        77.46,
        12.8
      ],
      [
        77.75,
        13.15
      ]
    ],
    "defaultZoom": 12.5
  },
  "coimbatore": {
    "id": "coimbatore",
    "displayName": "Coimbatore",
    "center": {
      "lat": 11.0247,
      "lon": 77.003,
      "name": "PSG College of Technology, Peelamedu, Coimbatore"
    },
    "defaultOrigin": {
      "lat": 11.0247,
      "lon": 77.003,
      "name": "PSG College of Technology, Peelamedu, Coimbatore"
    },
    "testOrigin": {
      "lat": 11.0247,
      "lon": 77.003,
      "name": "PSG College of Technology, Peelamedu, Coimbatore"
    },
    "testDestination": {
      "lat": 11.0323,
      "lon": 77.0266,
      "name": "Hope College, Coimbatore"
    },
    "mapBounds": [
      [
        76.8,
        10.9
      ],
      [
        77.15,
        11.2
      ]
    ],
    "defaultZoom": 12.5
  }
};

const envRegion = (process.env.NEXT_PUBLIC_ACTIVE_REGION || "coimbatore").trim().toLowerCase();
export const ACTIVE_REGION: RegionId = envRegion === "coimbatore" ? "coimbatore" : "bengaluru";
export const ACTIVE_REGION_CONFIG: RegionConfig = REGION_CONFIGS[ACTIVE_REGION];
export const ACTIVE_REGION_CENTER = ACTIVE_REGION_CONFIG.center;
export const ACTIVE_REGION_MAP_BOUNDS = ACTIVE_REGION_CONFIG.mapBounds;
