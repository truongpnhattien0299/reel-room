const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number) {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 || value >= 10 ? 0 : 1)} ${UNITS[unit]}`;
}

const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });
export const formatDate = (d: Date) => dateFormat.format(d);
