export function formatMoney(value: string | number, currency = 'KZT') {
  const num = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num);
}

export function formatPercent(value: string | number) {
  const num = typeof value === 'string' ? Number(value) : value;
  return `${num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;
}
