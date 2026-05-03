export function formatDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTimeForId(date = new Date()): string {
  const datePart = formatDate(date).replace(/-/g, "");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${datePart}_${hours}${minutes}${seconds}`;
}

export function isDueOnOrBefore(dateValue: string | undefined, today = formatDate()): boolean {
  if (!dateValue) {
    return false;
  }

  return dateValue <= today;
}
