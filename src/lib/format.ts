export function formatSom(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value).replace(/\u00A0/g, " ")} so'm`;
}

export function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(".0", "")}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
  return String(value);
}
