(() => {
  // ===== Подключение к Supabase =====
  const supabaseClient = window.supabase.createClient(
    "https://hpmocpehjdknsffilyee.supabase.co",
    "sb_publishable_8Pmmrw0lBWiMx5n6RwaK9w_z4-FKIFF"
  );

  // ===== Элементы формы =====
  const targetYearInput = document.getElementById("targetYear");
  const targetMonthInput = document.getElementById("targetMonth");
  const monthlyTargetInput = document.getElementById("monthlyTarget");
  const sourceInfoInput = document.getElementById("sourceInfo");

  const generateBtn = document.getElementById("generateBtn");
  const saveBtn = document.getElementById("saveBtn");
  const statusDiv = document.getElementById("status");

  // ===== Элементы блока итогов =====
  const summaryMonth = document.getElementById("summaryMonth");
  const summarySource = document.getElementById("summarySource");
  const summaryTarget = document.getElementById("summaryTarget");
  const summaryDays = document.getElementById("summaryDays");
  const summaryHours = document.getElementById("summaryHours");

  // ===== Таблица по дням =====
  const dailyPlanBody = document.getElementById("dailyPlanBody");

  // ===== Holiday calendar =====
  const holidayPrevBtn = document.getElementById("holidayPrevBtn");
  const holidayNextBtn = document.getElementById("holidayNextBtn");
  const holidayMonthLabel = document.getElementById("holidayMonthLabel");
  const holidayDays = document.getElementById("holidayDays");
  const saveHolidaysBtn = document.getElementById("saveHolidaysBtn");
  const holidayStatus = document.getElementById("holidayStatus");

  // ===== Названия дней недели =====
  const WEEKDAY_NAMES = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота"
  ];

  const WEEKDAY_SHORT_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const MONTH_NAMES_RU = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь"
  ];

  // ===== Сгенерированные данные в памяти =====
  let generatedDailyPlans = [];
  let generatedHourlyPlans = [];
  let generatedSourceLabel = "";

  // ===== Holiday picker state =====
  let holidayCalendarYear = Number(targetYearInput?.value) || new Date().getFullYear();
  let holidayCalendarMonth = Number(targetMonthInput?.value) || new Date().getMonth() + 1;
  let selectedHolidayDates = new Set();

  // ===== Формат валюты =====
  function formatCurrency(value) {
    return new Intl.NumberFormat("ru-RU").format(Math.round(Number(value) || 0)) + " ₸";
  }

  // ===== Формат месяца =====
  function formatMonthLabel(year, month) {
    return `${String(month).padStart(2, "0")}.${year}`;
  }

  function formatCalendarMonthLabel(year, month) {
    return `${MONTH_NAMES_RU[month - 1]} ${year}`;
  }

  // ===== Количество дней в месяце =====
  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // ===== ISO-формат даты =====
  function toISODate(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // ===== Информация по дате =====
  function getDateInfo(year, month, day) {
    const date = new Date(year, month - 1, day);

    return {
      iso: toISODate(year, month, day),
      weekdayNum: date.getDay(),
      weekdayName: WEEKDAY_NAMES[date.getDay()]
    };
  }

  // ===== Предыдущий месяц =====
  function getPreviousMonth(year, month) {
    if (month === 1) {
      return { year: year - 1, month: 12 };
    }

    return { year, month: month - 1 };
  }

  // ===== Сброс интерфейса =====
  function resetPlanView(message = "Сохраненный план не найден") {
    dailyPlanBody.innerHTML = "";
    summaryMonth.textContent = "—";
    summarySource.textContent = "—";
    summaryTarget.textContent = "—";
    summaryDays.textContent = "—";
    summaryHours.textContent = "—";

    generatedDailyPlans = [];
    generatedHourlyPlans = [];
    generatedSourceLabel = "";

    statusDiv.textContent = message;
  }

  // ===== Обновление поля с источником =====
  function updateSourceInfoLabel() {
    const targetYear = Number(targetYearInput.value);
    const targetMonth = Number(targetMonthInput.value);

    if (!targetYear || !targetMonth) {
      sourceInfoInput.value = "Автоматически: предыдущий месяц";
      return;
    }

    const prev = getPreviousMonth(targetYear, targetMonth);
    sourceInfoInput.value = `Автоматически: ${formatMonthLabel(prev.year, prev.month)}`;
  }

  // ===== Группировка факта по дням =====
  function groupDailyTotals(factRows) {
    const dailyMap = new Map();

    for (const row of factRows) {
      const key = row.fact_date;

      if (!dailyMap.has(key)) {
        const weekdayNum = new Date(row.fact_date).getDay();

        dailyMap.set(key, {
          fact_date: row.fact_date,
          weekday_num: weekdayNum,
          total_too: 0,
          total_gc: 0
        });
      }

      const current = dailyMap.get(key);
      current.total_too += Number(row.too) || 0;
      current.total_gc += Number(row.gc) || 0;
    }

    return Array.from(dailyMap.values()).sort((a, b) =>
      a.fact_date.localeCompare(b.fact_date)
    );
  }

  // ===== Среднее TOO по дням недели =====
  function buildWeekdayAverages(dailyTotals) {
    const weekdayMap = new Map();

    for (const day of dailyTotals) {
      if (!weekdayMap.has(day.weekday_num)) {
        weekdayMap.set(day.weekday_num, {
          sumToo: 0,
          count: 0
        });
      }

      const bucket = weekdayMap.get(day.weekday_num);
      bucket.sumToo += day.total_too;
      bucket.count += 1;
    }

    const result = new Map();

    for (const [weekdayNum, value] of weekdayMap.entries()) {
      result.set(weekdayNum, value.count > 0 ? value.sumToo / value.count : 0);
    }

    return result;
  }

  // ===== Почасовые доли по дням недели =====
  function buildHourlyWeekdayShares(factRows) {
    const weekdayHourMap = new Map();
    const weekdayDayTotals = new Map();

    for (const row of factRows) {
      const weekdayNum = new Date(row.fact_date).getDay();
      const hour = Number(row.fact_hour);
      const too = Number(row.too) || 0;

      if (!weekdayHourMap.has(weekdayNum)) {
        weekdayHourMap.set(weekdayNum, new Map());
      }

      if (!weekdayDayTotals.has(weekdayNum)) {
        weekdayDayTotals.set(weekdayNum, 0);
      }

      const hourMap = weekdayHourMap.get(weekdayNum);
      hourMap.set(hour, (hourMap.get(hour) || 0) + too);
      weekdayDayTotals.set(weekdayNum, weekdayDayTotals.get(weekdayNum) + too);
    }

    const sharesMap = new Map();

    for (const [weekdayNum, hourMap] of weekdayHourMap.entries()) {
      const total = weekdayDayTotals.get(weekdayNum) || 1;
      const normalized = new Map();

      for (let hour = 0; hour < 24; hour++) {
        const hourValue = hourMap.get(hour) || 0;
        normalized.set(hour, hourValue / total);
      }

      sharesMap.set(weekdayNum, normalized);
    }

    return sharesMap;
  }

  // ===== Средний чек по дням недели и часам =====
  function buildHourlyWeekdayAvgChecks(factRows) {
    const weekdayHourMap = new Map();

    for (const row of factRows) {
      const weekdayNum = new Date(row.fact_date).getDay();
      const hour = Number(row.fact_hour);
      const too = Number(row.too) || 0;
      const gc = Number(row.gc) || 0;

      if (!weekdayHourMap.has(weekdayNum)) {
        weekdayHourMap.set(weekdayNum, new Map());
      }

      const hourMap = weekdayHourMap.get(weekdayNum);

      if (!hourMap.has(hour)) {
        hourMap.set(hour, {
          totalToo: 0,
          totalGc: 0
        });
      }

      const bucket = hourMap.get(hour);
      bucket.totalToo += too;
      bucket.totalGc += gc;
    }

    const result = new Map();

    for (const [weekdayNum, hourMap] of weekdayHourMap.entries()) {
      const avgCheckMap = new Map();

      for (let hour = 0; hour < 24; hour++) {
        const bucket = hourMap.get(hour) || { totalToo: 0, totalGc: 0 };
        const avgCheck = bucket.totalGc > 0 ? bucket.totalToo / bucket.totalGc : 0;
        avgCheckMap.set(hour, avgCheck);
      }

      result.set(weekdayNum, avgCheckMap);
    }

    return result;
  }

  // ===== Загрузка настроек =====
  async function loadSettings() {
    const { data, error } = await supabaseClient
      .from("app_settings")
      .select("*")
      .limit(1)
      .single();

    if (error || !data) {
      throw new Error("Не удалось загрузить настройки");
    }

    return data;
  }

  // ===== Загрузка праздничных дней =====
  async function loadHolidayMap(targetYear, targetMonth) {
    const daysInMonth = getDaysInMonth(targetYear, targetMonth);
    const startDate = toISODate(targetYear, targetMonth, 1);
    const endDate = toISODate(targetYear, targetMonth, daysInMonth);

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

  // ===== Загрузка выбранных праздников для календаря =====
  async function loadSelectedHolidaysForMonth(year, month) {
    if (!holidayStatus) return;

    holidayStatus.textContent = "Загрузка праздников месяца...";

    try {
      const holidayMap = await loadHolidayMap(year, month);
      selectedHolidayDates = new Set(Array.from(holidayMap.keys()));
      renderHolidayCalendar();
      holidayStatus.textContent = selectedHolidayDates.size
        ? `Загружено праздничных дней: ${selectedHolidayDates.size}`
        : "Праздничные дни не выбраны";
    } catch (error) {
      console.error(error);
      selectedHolidayDates = new Set();
      renderHolidayCalendar();
      holidayStatus.textContent = "Ошибка загрузки праздников ❌";
    }
  }

  // ===== Обновить календарь по выбранным году и месяцу =====
  async function updateHolidayCalendarFromInputs() {
    holidayCalendarYear = Number(targetYearInput.value);
    holidayCalendarMonth = Number(targetMonthInput.value);

    renderHolidayCalendar();
    await loadSelectedHolidaysForMonth(holidayCalendarYear, holidayCalendarMonth);
  }

  // ===== Сдвиг календаря праздников =====
  async function shiftHolidayCalendarMonth(delta) {
    holidayCalendarMonth += delta;

    if (holidayCalendarMonth < 1) {
      holidayCalendarMonth = 12;
      holidayCalendarYear -= 1;
    }

    if (holidayCalendarMonth > 12) {
      holidayCalendarMonth = 1;
      holidayCalendarYear += 1;
    }

    targetYearInput.value = holidayCalendarYear;
    targetMonthInput.value = holidayCalendarMonth;

    updateSourceInfoLabel();
    renderHolidayCalendar();
    await loadSelectedHolidaysForMonth(holidayCalendarYear, holidayCalendarMonth);
    await loadSavedPlan();
  }

  // ===== Порядок дней недели: понедельник -> воскресенье =====
  function getMondayFirstWeekday(date) {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
  }

  // ===== Отрисовка календаря =====
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

    // Предыдущий месяц
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

    // Текущий месяц
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

    // Следующий месяц
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

  // ===== Сохранение выбранных праздников =====
  async function saveSelectedHolidays() {
    const year = holidayCalendarYear;
    const month = holidayCalendarMonth;
    const daysInMonth = getDaysInMonth(year, month);
    const startDate = toISODate(year, month, 1);
    const endDate = toISODate(year, month, daysInMonth);

    holidayStatus.textContent = "Сохранение праздников...";

    try {
      const { error: deleteError } = await supabaseClient
        .from("holiday_calendar")
        .delete()
        .gte("holiday_date", startDate)
        .lte("holiday_date", endDate);

      if (deleteError) {
        throw new Error("Ошибка очистки holiday_calendar");
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
          throw new Error("Ошибка сохранения holiday_calendar");
        }
      }

      holidayStatus.textContent = rows.length
        ? `Праздники сохранены ✅ (${rows.length})`
        : "Праздничные дни очищены ✅";
    } catch (error) {
      console.error(error);
      holidayStatus.textContent = `${error.message} ❌`;
    }
  }

  // ===== Поиск источника факта: предыдущий месяц =====
  async function findPreviousMonthUpload(targetYear, targetMonth) {
    const prev = getPreviousMonth(targetYear, targetMonth);

    const { data, error } = await supabaseClient
      .from("fact_uploads")
      .select("id, file_name, period_year, period_month, uploaded_at")
      .eq("period_year", prev.year)
      .eq("period_month", prev.month)
      .order("uploaded_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error("Ошибка загрузки источника предыдущего месяца");
    }

    if (!data || !data.length) {
      throw new Error(`Не найден fact_upload за ${formatMonthLabel(prev.year, prev.month)}`);
    }

    return data[0];
  }

  // ===== Определение типа дня =====
  function getDayType(dateInfo, holidayMap) {
    const currentDate = dateInfo.iso;
    const current = new Date(dateInfo.iso);

    const prev = new Date(current);
    prev.setDate(current.getDate() - 1);

    const next = new Date(current);
    next.setDate(current.getDate() + 1);

    const prevDate = toISODate(prev.getFullYear(), prev.getMonth() + 1, prev.getDate());
    const nextDate = toISODate(next.getFullYear(), next.getMonth() + 1, next.getDate());

    if (holidayMap.has(currentDate)) return "holiday";
    if (holidayMap.has(nextDate)) return "pre_holiday";
    if (holidayMap.has(prevDate)) return "post_holiday";
    if ([0, 6].includes(dateInfo.weekdayNum)) return "weekend";

    return "weekday";
  }

  // ===== Коэффициент дня =====
  function getDayMultiplier(dayType, settings, holidayMap, dateIso) {
    if (dayType === "holiday") {
      const holiday = holidayMap.get(dateIso);
      return Number(holiday?.impact_multiplier) || Number(settings.holiday_multiplier) || 1;
    }

    if (dayType === "pre_holiday") {
      return Number(settings.pre_holiday_multiplier) || 1;
    }

    if (dayType === "post_holiday") {
      return Number(settings.post_holiday_multiplier) || 1;
    }

    if (dayType === "weekend") {
      return Number(settings.weekend_multiplier) || 1;
    }

    return Number(settings.weekday_multiplier) || 1;
  }

  // ===== Генерация плана =====
  async function generatePlan() {
    const targetYear = Number(targetYearInput.value);
    const targetMonth = Number(targetMonthInput.value);
    const monthlyTarget = Number(monthlyTargetInput.value);

    if (!targetYear || !targetMonth) {
      alert("Жыл мен айды енгіз");
      return;
    }

    if (!monthlyTarget || monthlyTarget <= 0) {
      alert("План на месяц енгіз");
      return;
    }

    try {
      statusDiv.textContent = "Загрузка настроек...";
      const settings = await loadSettings();

      statusDiv.textContent = "Поиск источника предыдущего месяца...";
      const upload = await findPreviousMonthUpload(targetYear, targetMonth);

      generatedSourceLabel = `${upload.file_name} — ${String(upload.period_month).padStart(2, "0")}.${upload.period_year}`;

      statusDiv.textContent = "Загрузка праздничных дней...";
      const holidayMap = settings.holiday_enabled
        ? await loadHolidayMap(targetYear, targetMonth)
        : new Map();

      statusDiv.textContent = "Загрузка fact_data...";
      const { data: factRows, error } = await supabaseClient
        .from("fact_data")
        .select("fact_date, fact_hour, gc, too")
        .eq("upload_id", upload.id)
        .order("fact_date", { ascending: true })
        .order("fact_hour", { ascending: true });

      if (error) {
        throw new Error("Ошибка загрузки fact_data");
      }

      if (!factRows || !factRows.length) {
        throw new Error("По источнику нет fact_data");
      }

      const dailyTotals = groupDailyTotals(factRows);
      const weekdayAverages = buildWeekdayAverages(dailyTotals);
      const hourlyShares = buildHourlyWeekdayShares(factRows);
      const hourlyAvgChecks = buildHourlyWeekdayAvgChecks(factRows);

      const daysInMonth = getDaysInMonth(targetYear, targetMonth);
      const rawDailyPlans = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateInfo = getDateInfo(targetYear, targetMonth, day);

        const baseValue = weekdayAverages.get(dateInfo.weekdayNum) || 0;
        const dayType = getDayType(dateInfo, holidayMap);
        const multiplier = getDayMultiplier(dayType, settings, holidayMap, dateInfo.iso);
        const weightedPlan = baseValue * multiplier;

        rawDailyPlans.push({
          plan_date: dateInfo.iso,
          weekday_num: dateInfo.weekdayNum,
          weekday_name: dateInfo.weekdayName,
          day_type: dayType,
          multiplier,
          base_plan: baseValue,
          weighted_plan: weightedPlan,
          final_plan: 0
        });
      }

      const rawTotal = rawDailyPlans.reduce((sum, d) => sum + d.weighted_plan, 0);
      const normalizeFactor = rawTotal > 0 ? monthlyTarget / rawTotal : 0;

      generatedDailyPlans = rawDailyPlans.map((d) => ({
        ...d,
        final_plan: Math.round(d.weighted_plan * normalizeFactor)
      }));

      generatedHourlyPlans = [];

      for (const day of generatedDailyPlans) {
        const shareMap = hourlyShares.get(day.weekday_num) || new Map();
        const avgCheckMap = hourlyAvgChecks.get(day.weekday_num) || new Map();

        let distributed = 0;

        for (let hour = 0; hour < 24; hour++) {
          let too;

          if (hour === 23) {
            too = day.final_plan - distributed;
          } else {
            const share = shareMap.get(hour) || 0;
            too = Math.round(day.final_plan * share);
            distributed += too;
          }

          const historicalAvgCheck = avgCheckMap.get(hour) || 0;

          let gc;
          if (settings.gc_mode === "fixed") {
            gc = settings.default_avg_check > 0
              ? Math.round(too / settings.default_avg_check)
              : 0;
          } else {
            gc = historicalAvgCheck > 0
              ? Math.round(too / historicalAvgCheck)
              : 0;
          }

          generatedHourlyPlans.push({
            plan_date: day.plan_date,
            plan_hour: hour,
            gc,
            too,
            weekday_num: day.weekday_num,
            day_type: day.day_type
          });
        }
      }

      renderDailyPlans(targetYear, targetMonth, monthlyTarget);
      statusDiv.textContent = "План сгенерирован ✅";
    } catch (err) {
      console.error(err);
      statusDiv.textContent = err.message + " ❌";
    }
  }

  // ===== Отрисовка таблицы =====
  function renderDailyPlans(targetYear, targetMonth, monthlyTarget) {
    dailyPlanBody.innerHTML = "";

    generatedDailyPlans.forEach((day) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${day.plan_date}</td>
        <td>${day.weekday_name}</td>
        <td>${day.day_type}</td>
        <td>${Number(day.multiplier).toFixed(2)}</td>
        <td>${formatCurrency(day.final_plan)}</td>
      `;
      dailyPlanBody.appendChild(tr);
    });

    summaryMonth.textContent = formatMonthLabel(targetYear, targetMonth);
    summarySource.textContent = generatedSourceLabel || "—";
    summaryTarget.textContent = formatCurrency(monthlyTarget);
    summaryDays.textContent = String(generatedDailyPlans.length);
    summaryHours.textContent = String(generatedHourlyPlans.length);
  }

  // ===== Отрисовка сохраненного плана =====
  function renderSavedPlanRows(targetYear, targetMonth, hourlyRows) {
    dailyPlanBody.innerHTML = "";

    const dailyMap = new Map();

    for (const row of hourlyRows) {
      const key = row.plan_date;

      if (!dailyMap.has(key)) {
        const weekdayNum = Number(row.weekday_num);

        dailyMap.set(key, {
          plan_date: row.plan_date,
          weekday_num: weekdayNum,
          weekday_name: WEEKDAY_NAMES[weekdayNum],
          day_type: row.day_type || "normal",
          multiplier: 1,
          final_plan: 0
        });
      }

      const current = dailyMap.get(key);
      current.final_plan += Number(row.too) || 0;
    }

    generatedDailyPlans = Array.from(dailyMap.values()).sort((a, b) =>
      a.plan_date.localeCompare(b.plan_date)
    );

    generatedHourlyPlans = [...hourlyRows].sort((a, b) => {
      if (a.plan_date === b.plan_date) {
        return Number(a.plan_hour) - Number(b.plan_hour);
      }
      return a.plan_date.localeCompare(b.plan_date);
    });

    const monthlyTarget = generatedDailyPlans.reduce(
      (sum, day) => sum + (Number(day.final_plan) || 0),
      0
    );

    generatedDailyPlans.forEach((day) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${day.plan_date}</td>
        <td>${day.weekday_name}</td>
        <td>${day.day_type}</td>
        <td>—</td>
        <td>${formatCurrency(day.final_plan)}</td>
      `;
      dailyPlanBody.appendChild(tr);
    });

    summaryMonth.textContent = formatMonthLabel(targetYear, targetMonth);
    summarySource.textContent = "Сохраненный план";
    summaryTarget.textContent = formatCurrency(monthlyTarget);
    summaryDays.textContent = String(generatedDailyPlans.length);
    summaryHours.textContent = String(generatedHourlyPlans.length);
  }

  // ===== Загрузка сохраненного плана =====
  async function loadSavedPlan() {
    const targetYear = Number(targetYearInput.value);
    const targetMonth = Number(targetMonthInput.value);

    if (!targetYear || !targetMonth) {
      resetPlanView("Выбери год и месяц");
      return;
    }

    statusDiv.textContent = "Загрузка сохраненного плана...";

    const { data: runData, error: runError } = await supabaseClient
      .from("plan_runs")
      .select("id, target_year, target_month")
      .eq("target_year", targetYear)
      .eq("target_month", targetMonth)
      .maybeSingle();

    if (runError) {
      console.error(runError);
      statusDiv.textContent = "Ошибка загрузки plan_run ❌";
      return;
    }

    if (!runData) {
      updateSourceInfoLabel();
      resetPlanView("Сохраненный план не найден");
      return;
    }

    const { data: planRows, error: planError } = await supabaseClient
      .from("plan_data")
      .select("plan_date, plan_hour, gc, too, weekday_num, day_type")
      .eq("plan_run_id", runData.id)
      .order("plan_date", { ascending: true })
      .order("plan_hour", { ascending: true });

    if (planError) {
      console.error(planError);
      statusDiv.textContent = "Ошибка загрузки plan_data ❌";
      return;
    }

    if (!planRows || !planRows.length) {
      updateSourceInfoLabel();
      resetPlanView("Сохраненный план пуст");
      return;
    }

    renderSavedPlanRows(targetYear, targetMonth, planRows);
    statusDiv.textContent = "Сохраненный план загружен ✅";
  }

  // ===== Сохранение плана =====
  async function savePlan() {
    if (!generatedDailyPlans.length || !generatedHourlyPlans.length) {
      alert("Сначала сгенерируй план");
      return;
    }

    const targetYear = Number(targetYearInput.value);
    const targetMonth = Number(targetMonthInput.value);

    statusDiv.textContent = "Сохранение plan_run...";

    const { data: runData, error: runError } = await supabaseClient
      .from("plan_runs")
      .upsert(
        {
          target_year: targetYear,
          target_month: targetMonth,
          use_prev_month: true,
          use_same_month_last_year: false,
          prev_month_weight: 1,
          last_year_weight: 0
        },
        {
          onConflict: "target_year,target_month"
        }
      )
      .select()
      .single();

    if (runError) {
      console.error(runError);
      statusDiv.textContent = "Ошибка сохранения run ❌";
      return;
    }

    const planRunId = runData.id;

    statusDiv.textContent = "Очистка старого plan_data...";

    const { error: deleteError } = await supabaseClient
      .from("plan_data")
      .delete()
      .eq("plan_run_id", planRunId);

    if (deleteError) {
      console.error(deleteError);
      statusDiv.textContent = "Ошибка удаления старого plan_data ❌";
      return;
    }

    const planRows = generatedHourlyPlans.map((row) => ({
      plan_run_id: planRunId,
      plan_date: row.plan_date,
      plan_hour: row.plan_hour,
      gc: row.gc,
      too: row.too,
      weekday_num: row.weekday_num,
      day_type: row.day_type
    }));

    statusDiv.textContent = "Сохранение нового plan_data...";

    const { error: dataError } = await supabaseClient
      .from("plan_data")
      .insert(planRows);

    if (dataError) {
      console.error(dataError);
      statusDiv.textContent = "Ошибка сохранения plan_data ❌";
      return;
    }

    await loadSavedPlan();
    statusDiv.textContent = "План сохранен и обновлен ✅";
  }

  // ===== События =====
  generateBtn?.addEventListener("click", generatePlan);
  saveBtn?.addEventListener("click", savePlan);
  holidayPrevBtn?.addEventListener("click", () => shiftHolidayCalendarMonth(-1));
  holidayNextBtn?.addEventListener("click", () => shiftHolidayCalendarMonth(1));
  saveHolidaysBtn?.addEventListener("click", saveSelectedHolidays);

  targetYearInput?.addEventListener("change", async () => {
    updateSourceInfoLabel();
    await updateHolidayCalendarFromInputs();
    await loadSavedPlan();
  });

  targetMonthInput?.addEventListener("change", async () => {
    updateSourceInfoLabel();
    await updateHolidayCalendarFromInputs();
    await loadSavedPlan();
  });

  // ===== Инициализация =====
  (async () => {
    updateSourceInfoLabel();
    renderHolidayCalendar();
    await updateHolidayCalendarFromInputs();
    await loadSavedPlan();
  })();
})();