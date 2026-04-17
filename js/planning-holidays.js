let selectedHolidayDates = new Set();

function getMondayFirstWeekday(date) {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

async function loadHolidayMap(year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const startDate = toISODate(year, month, 1);
  const endDate = toISODate(year, month, daysInMonth);

  const { data, error } = await supabaseClient
    .from("holiday_calendar")
    .select("holiday_date, holiday_name, impact_multiplier, is_active")
    .gte("holiday_date", startDate)
    .lte("holiday_date", endDate)
    .eq("is_active", true);

  if (error) {
    console.error(error);
    return new Map();
  }

  const holidayMap = new Map();
  for (const item of data || []) {
    holidayMap.set(item.holiday_date, item);
  }

  return holidayMap;
}

async function loadSelectedHolidaysForMonth(year, month) {
  if (holidayStatus) {
    holidayStatus.textContent = "Загрузка праздников месяца...";
  }

  const holidayMap = await loadHolidayMap(year, month);
  selectedHolidayDates = new Set(Array.from(holidayMap.keys()));

  renderHolidayCalendar();

  if (holidayStatus) {
    holidayStatus.textContent = selectedHolidayDates.size
      ? `Загружено праздничных дней: ${selectedHolidayDates.size}`
      : "Праздничные дни не выбраны";
  }
}

function renderHolidayCalendar() {
  if (!holidayMonthLabel || !holidayDays) return;

  holidayMonthLabel.textContent = formatCalendarMonthLabel(
    holidayCalendarYear,
    holidayCalendarMonth
  );

  holidayDays.innerHTML = "";

  const firstDate = new Date(holidayCalendarYear, holidayCalendarMonth - 1, 1);
  const daysInCurrentMonth = getDaysInMonth(holidayCalendarYear, holidayCalendarMonth);

  const prevMonth =
    holidayCalendarMonth === 1
      ? { year: holidayCalendarYear - 1, month: 12 }
      : { year: holidayCalendarYear, month: holidayCalendarMonth - 1 };

  const nextMonth =
    holidayCalendarMonth === 12
      ? { year: holidayCalendarYear + 1, month: 1 }
      : { year: holidayCalendarYear, month: holidayCalendarMonth + 1 };

  const daysInPrevMonth = getDaysInMonth(prevMonth.year, prevMonth.month);
  const leadingDays = getMondayFirstWeekday(firstDate);

  for (let i = leadingDays - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const iso = toISODate(prevMonth.year, prevMonth.month, day);
    const button = createCalendarDayButton({
      year: prevMonth.year,
      month: prevMonth.month,
      day,
      iso,
      isOtherMonth: true
    });
    holidayDays.appendChild(button);
  }

  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const iso = toISODate(holidayCalendarYear, holidayCalendarMonth, day);
    const button = createCalendarDayButton({
      year: holidayCalendarYear,
      month: holidayCalendarMonth,
      day,
      iso,
      isOtherMonth: false
    });
    holidayDays.appendChild(button);
  }

  const totalRendered = leadingDays + daysInCurrentMonth;
  const trailingDays = totalRendered % 7 === 0 ? 0 : 7 - (totalRendered % 7);

  for (let day = 1; day <= trailingDays; day++) {
    const iso = toISODate(nextMonth.year, nextMonth.month, day);
    const button = createCalendarDayButton({
      year: nextMonth.year,
      month: nextMonth.month,
      day,
      iso,
      isOtherMonth: true
    });
    holidayDays.appendChild(button);
  }
}

function createCalendarDayButton({ year, month, day, iso, isOtherMonth }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "calendar-day";

  if (isOtherMonth) {
    button.classList.add("other-month");
  }

  if (selectedHolidayDates.has(iso)) {
    button.classList.add("selected");
  }

  const today = new Date();
  const isToday =
    today.getFullYear() === year &&
    today.getMonth() + 1 === month &&
    today.getDate() === day;

  if (isToday) {
    button.classList.add("today");
  }

  button.textContent = String(day);
  button.dataset.date = iso;

  button.addEventListener("click", () => {
    if (isOtherMonth) {
      holidayCalendarYear = year;
      holidayCalendarMonth = month;
      targetYearInput.value = year;
      targetMonthInput.value = month;
      updateSourceInfoLabel();
    }

    toggleHolidayDate(iso);
  });

  return button;
}

function toggleHolidayDate(dateIso) {
  if (selectedHolidayDates.has(dateIso)) {
    selectedHolidayDates.delete(dateIso);
  } else {
    selectedHolidayDates.add(dateIso);
  }

  renderHolidayCalendar();

  if (holidayStatus) {
    holidayStatus.textContent = `Выбрано праздничных дней: ${selectedHolidayDates.size}`;
  }
}

async function saveSelectedHolidays() {
  const year = holidayCalendarYear;
  const month = holidayCalendarMonth;
  const daysInMonth = getDaysInMonth(year, month);
  const startDate = toISODate(year, month, 1);
  const endDate = toISODate(year, month, daysInMonth);

  if (holidayStatus) {
    holidayStatus.textContent = "Сохранение праздников...";
  }

  try {
    const { error: deleteError } = await supabaseClient
      .from("holiday_calendar")
      .delete()
      .gte("holiday_date", startDate)
      .lte("holiday_date", endDate);

    if (deleteError) {
      throw deleteError;
    }

    const rows = Array.from(selectedHolidayDates)
      .filter((date) => date >= startDate && date <= endDate)
      .sort()
      .map((holidayDate) => ({
        holiday_date: holidayDate,
        holiday_name: "Праздничный день",
        impact_multiplier: null,
        is_active: true
      }));

    if (rows.length) {
      const { error: insertError } = await supabaseClient
        .from("holiday_calendar")
        .insert(rows);

      if (insertError) {
        throw insertError;
      }
    }

    if (holidayStatus) {
      holidayStatus.textContent = rows.length
        ? `Праздники сохранены ✅ (${rows.length})`
        : "Праздничные дни очищены ✅";
    }

    closeHolidayModal();
  } catch (error) {
    console.error(error);
    if (holidayStatus) {
      holidayStatus.textContent = "Ошибка сохранения праздников ❌";
    }
  }
}