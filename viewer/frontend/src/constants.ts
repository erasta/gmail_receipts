export const pad = (n: number) => String(n).padStart(2, "0");

export const CURRENT_YEAR = new Date().getFullYear();
export const YEARS = Array.from(
  { length: CURRENT_YEAR - 2020 + 1 },
  (_, i) => 2020 + i,
);
export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const isImage = (filename: string) =>
  /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
export const isPdf = (filename: string) => /\.pdf$/i.test(filename);
