export const WCA_EVENT_NAMES: Record<string, string> = {
  "222": "2x2x2 Cube",
  "333": "3x3x3 Cube",
  "444": "4x4x4 Cube",
  "555": "5x5x5 Cube",
  "666": "6x6x6 Cube",
  "777": "7x7x7 Cube",
  "333oh": "3x3x3 One-Handed",
  "333bf": "3x3x3 Blindfolded",
  "444bf": "4x4x4 Blindfolded",
  "555bf": "5x5x5 Blindfolded",
  "333mbf": "3x3x3 Multi-Blind",
  "333fm": "3x3x3 Fewest Moves",
  clock: "Clock",
  minx: "Megaminx",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1"
};

export function getWCAEventName(eventId?: string | null, fallback?: string | null) {
  return eventId && Object.hasOwn(WCA_EVENT_NAMES, eventId)
    ? WCA_EVENT_NAMES[eventId]
    : fallback || "Event";
}
