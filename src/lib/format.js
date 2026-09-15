export function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value || 0))
}

export function formatCents(value) {
  return formatCurrency(Number(value || 0) / 100)
}

export function formatDate(value) {
  if (!value) return 'Sin fecha'

  const rawValue = String(value).trim()
  const calendarDate = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (calendarDate) {
    const [, year, month, day] = calendarDate
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))

    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(date)
  }

  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(rawValue))
}
