/** Formatting helpers. Currency always follows the org (§7.5): £29, ₦15,000. */
export function formatMoney(amount: number, currency: "GBP" | "NGN") {
  return new Intl.NumberFormat(currency === "GBP" ? "en-GB" : "en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function greeting(timeZone: string, now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function longDate(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(now);
}

/** Credits are stored as milli-credits and shown to one decimal place (§5). */
export function formatCredits(millicredits: number) {
  return (Math.floor(millicredits / 100) / 10).toFixed(1);
}
