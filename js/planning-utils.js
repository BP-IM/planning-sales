// ===== Формат =====
function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(Number(value) || 0)) + " ₸";
}

function formatMonthLabel(year, month) {
  return `${String(month).padStart(2, "0")}.${year}`;
}

function formatCalendarMonthLabel(year, month) {
  return `${MONTH_NAMES_RU[month - 1]} ${year}`;
}

// ===== Дата =====
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function toISODate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDateInfo(year, month, day) {
  const date = new Date(year, month - 1, day);
  return {
    iso: toISODate(year, month, day),
    weekdayNum: date.getDay(),
    weekdayName: WEEKDAY_NAMES[date.getDay()]
  };
}

function getPreviousMonth(year, month) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}