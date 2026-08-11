export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export const inrCompact = (n: number) => {
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
};

export const fmtDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const daysBetween = (a: Date, b: Date) =>
  Math.round((a.getTime() - b.getTime()) / 86400000);

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const todayISO = () => isoDate(new Date());

export const addDays = (base: Date | string, days: number) => {
  const d = typeof base === "string" ? new Date(base) : new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};
