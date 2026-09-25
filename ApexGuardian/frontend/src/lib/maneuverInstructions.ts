/**
 * Maneuver Instruction Builder
 *
 * Converts OSRM's raw maneuver objects (type, modifier, exit) into natural-language
 * turn-by-turn instructions, since OSRM API responses do not include pre-built instruction strings.
 */

export interface OSRMManeuver {
  type?: string;
  modifier?: string;
  exit?: number;
  bearing_after?: number;
  bearing_before?: number;
  location?: [number, number];
  instruction?: string;
}

export interface OSRMStep {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: OSRMManeuver;
  mode?: string;
  geometry?: any;
}

/**
 * Builds a natural-language instruction from an OSRM step's maneuver object and road name.
 */
export function getManeuverInstruction(step: OSRMStep): string {
  const maneuver = step.maneuver;
  const roadName = step.name?.trim() || "";

  if (!maneuver || !maneuver.type) {
    return roadName || "Continue straight ahead";
  }

  const type = maneuver.type.toLowerCase();
  let modifier = maneuver.modifier?.toLowerCase() || "";
  const exit = maneuver.exit;

  // Mathematically verify L/R directions
  if (maneuver.bearing_before !== undefined && maneuver.bearing_after !== undefined) {
    const bBefore = maneuver.bearing_before;
    const bAfter = maneuver.bearing_after;
    let diff = bAfter - bBefore;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;
    
    // diff < 0 is left, diff > 0 is right
    if (Math.abs(diff) > 10) { // Only override if it's a clear turn
      if (diff < -10 && modifier.includes("right")) {
        modifier = modifier.replace("right", "left");
      } else if (diff > 10 && modifier.includes("left")) {
        modifier = modifier.replace("left", "right");
      }
    }
  }

  // Helper to add road name
  const withRoad = (instruction: string): string => {
    if (roadName && roadName !== "") {
      return `${instruction} onto ${roadName}`;
    }
    return instruction;
  };

  // Departure
  if (type === "depart") {
    if (roadName) {
      return `Head out on ${roadName}`;
    }
    if (modifier.includes("left")) return "Head out turning left";
    if (modifier.includes("right")) return "Head out turning right";
    return "Head out";
  }

  // Arrival
  if (type === "arrive") {
    if (modifier === "left") return "Arrive at your destination on the left";
    if (modifier === "right") return "Arrive at your destination on the right";
    if (modifier === "straight") return "Arrive at your destination ahead";
    return "You have arrived at your destination";
  }

  // Turns
  if (type === "turn") {
    if (modifier === "left") return withRoad("Turn left");
    if (modifier === "right") return withRoad("Turn right");
    if (modifier === "slight left") return withRoad("Bear left");
    if (modifier === "slight right") return withRoad("Bear right");
    if (modifier === "sharp left") return withRoad("Make a sharp left");
    if (modifier === "sharp right") return withRoad("Make a sharp right");
    if (modifier === "uturn" || modifier === "u-turn") return withRoad("Make a U-turn");
    if (modifier === "straight") return withRoad("Continue straight");
    return roadName ? `Continue on ${roadName}` : "Continue straight ahead";
  }

  // Continue on new road name
  if (type === "new name" || type === "continue") {
    if (roadName) {
      return `Continue on ${roadName}`;
    }
    return "Continue ahead";
  }

  // Merge
  if (type === "merge") {
    if (modifier === "left") return withRoad("Merge left");
    if (modifier === "right") return withRoad("Merge right");
    if (modifier === "slight left") return withRoad("Merge slightly left");
    if (modifier === "slight right") return withRoad("Merge slightly right");
    return withRoad("Merge");
  }

  // Fork
  if (type === "fork") {
    if (modifier === "left") return withRoad("Keep left at the fork");
    if (modifier === "right") return withRoad("Keep right at the fork");
    if (modifier === "slight left") return withRoad("Bear left at the fork");
    if (modifier === "slight right") return withRoad("Bear right at the fork");
    return withRoad("Continue at the fork");
  }

  // Roundabouts
  if (type === "roundabout" || type === "rotary") {
    if (exit !== undefined) {
      const exitOrdinal = getOrdinal(exit);
      return withRoad(`At the roundabout, take the ${exitOrdinal} exit`);
    }
    return withRoad("Enter the roundabout");
  }

  if (type === "roundabout turn") {
    if (modifier === "left") return withRoad("Turn left at the roundabout");
    if (modifier === "right") return withRoad("Turn right at the roundabout");
    return withRoad("Continue through the roundabout");
  }

  if (type === "exit roundabout" || type === "exit rotary") {
    if (exit !== undefined) {
      return withRoad(`Exit the roundabout at the ${getOrdinal(exit)} exit`);
    }
    return withRoad("Exit the roundabout");
  }

  // Ramps
  if (type === "on ramp" || type === "ramp") {
    if (modifier === "left") return withRoad("Take the ramp on the left");
    if (modifier === "right") return withRoad("Take the ramp on the right");
    if (modifier === "slight left") return withRoad("Take the slight left ramp");
    if (modifier === "slight right") return withRoad("Take the slight right ramp");
    return withRoad("Take the ramp");
  }

  if (type === "off ramp") {
    if (modifier === "left") return withRoad("Take the exit on the left");
    if (modifier === "right") return withRoad("Take the exit on the right");
    if (modifier === "slight left") return withRoad("Take the slight left exit");
    if (modifier === "slight right") return withRoad("Take the slight right exit");
    return withRoad("Take the exit");
  }

  // End of road
  if (type === "end of road") {
    if (modifier === "left") return withRoad("At the end of the road, turn left");
    if (modifier === "right") return withRoad("At the end of the road, turn right");
    return withRoad("Continue at the end of the road");
  }

  // Notification (road name change, no action required)
  if (type === "notification") {
    if (roadName) {
      return `Continue on ${roadName}`;
    }
    return "Continue ahead";
  }

  // Fallback for unknown types
  if (roadName) {
    return `Continue on ${roadName}`;
  }
  return "Continue straight ahead";
}

/**
 * Builds a distance-aware announcement for advance warnings.
 * Example: "In 300 meters, turn right onto 5th Cross Road"
 */
export function getManeuverAnnouncement(step: OSRMStep, distanceMeters: number): string {
  const instruction = getManeuverInstruction(step);
  const maneuver = step.maneuver;

  // Don't add distance prefix for arrivals or departures
  if (maneuver?.type === "arrive" || maneuver?.type === "depart") {
    return instruction;
  }

  // Format distance
  let distancePhrase = "";
  if (distanceMeters >= 1000) {
    const km = (distanceMeters / 1000).toFixed(1);
    distancePhrase = `In ${km} kilometers`;
  } else if (distanceMeters >= 100) {
    const roundedMeters = Math.round(distanceMeters / 50) * 50; // Round to nearest 50m
    distancePhrase = `In ${roundedMeters} meters`;
  } else {
    distancePhrase = "Now";
  }

  // For very short distances, just say the instruction without distance
  if (distanceMeters < 50) {
    return instruction;
  }

  // Combine distance + instruction
  // Lower-case first letter of instruction when prefixing with distance
  const instructionLower = instruction.charAt(0).toLowerCase() + instruction.slice(1);
  return `${distancePhrase}, ${instructionLower}`;
}

/**
 * Converts a number to its ordinal form (1 -> "1st", 2 -> "2nd", etc.)
 */
function getOrdinal(n: number): string {
  const ordinals = [
    "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
    "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth",
  ];
  if (!Number.isFinite(n) || n < 1) return "next";
  const ordinal = Math.floor(n);
  if (ordinals[ordinal]) return ordinals[ordinal];
  const mod100 = ordinal % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ordinal % 10 === 1 ? "st" : ordinal % 10 === 2 ? "nd" : ordinal % 10 === 3 ? "rd" : "th";
  return `${ordinal}${suffix}`;
}
