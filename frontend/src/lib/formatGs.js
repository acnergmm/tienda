const formatter = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0,
});

// Montos en guaraníes enteros → "Gs. 150.000"
export function formatGs(monto) {
  return formatter.format(monto);
}
