import { getWCAEventName, WCA_EVENT_NAMES } from "@/lib/wca-events";

export function WCAEventLabel({ eventId, fallback }: { eventId?: string | null; fallback?: string | null }) {
  return (
    <span className="wca-event-label">
      {eventId && Object.hasOwn(WCA_EVENT_NAMES, eventId) && (
        <span aria-hidden="true" className={`cubing-icon event-${eventId}`} />
      )}
      <span>{getWCAEventName(eventId, fallback)}</span>
    </span>
  );
}
