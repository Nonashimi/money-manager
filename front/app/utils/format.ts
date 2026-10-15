export function formatMoney(value: string | number, currency = 'KZT') {
  const num = typeof value === 'string' ? Number(value) : value;
  // Some ICU builds render KZT as the code instead of the tenge sign, so the sign is set explicitly.
  if (currency === 'KZT') {
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num)}\u00A0₸`;
  }
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num);
}

export function formatPercent(value: string | number) {
  const num = typeof value === 'string' ? Number(value) : value;
  return `${num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;
}
