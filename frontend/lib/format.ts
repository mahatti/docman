export function formatSize(bytes: number) {
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(0)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function jakartaParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return {
    day: read("day"),
    month: Number(read("month")),
    year: read("year"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

export function formatDate(d: Date) {
  if (Number.isNaN(d.getTime())) return "—";
  const parts = jakartaParts(d);
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

export function formatActivityTime(d: Date) {
  if (Number.isNaN(d.getTime())) return "—";
  const parts = jakartaParts(d);
  const now = jakartaParts(new Date());
  if (parts.day === now.day && parts.month === now.month && parts.year === now.year) {
    return `${pad2(Number(parts.hour))}:${pad2(Number(parts.minute))}`;
  }
  return formatDate(d);
}
