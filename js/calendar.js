(() => {
  // ===== Supabase =====
  const supabaseClient = window.supabase.createClient(
    "https://hpmocpehjdknsffilyee.supabase.co",
    "sb_publishable_8Pmmrw0lBWiMx5n6RwaK9w_z4-FKIFF"
  );

  // ===== DOM =====
  const yearInput = document.getElementById("year");
  const monthInput = document.getElementById("month");
  const dayInput = document.getElementById("day");

  const loadBtn = document.getElementById("loadBtn");
  const toggleHolidayBtn = document.getElementById("toggleHolidayBtn");
  const exportExcelBtn = document.getElementById("exportExcelBtn");

  const holidayBadge = document.getElementById("holidayBadge");
  const statusDiv = document.getElementById("status");

  const tableBody = document.getElementById("tableBody");
  const totalToo = document.getElementById("totalToo");
  const totalGc = document.getElementById("totalGc");
  const avgCheck = document.getElementById("avgCheck");

  // ===== Constants =====
  const WEEKDAY_NAMES = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота"
  ];

  let currentHolidayRow = null;

  // ===== Helpers =====
  function format(num) {
    return new Intl.NumberFormat("ru-RU").format(Math.round(Number(num) || 0));
  }

  function formatCurrency(num) {
    return `${format(num)} ₸`;
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function toISODate(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function getSelectedDateParts() {
    const y = Number(yearInput.value);
    const m = Number(monthInput.value);
    const d = Number(dayInput.value);

    return { y, m, d };
  }

  function getSelectedDateIso() {
    const { y, m, d } = getSelectedDateParts();
    return toISODate(y, m, d);
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
    if (month === 1) {
      return { year: year - 1, month: 12 };
    }
    return { year, month: month - 1 };
  }

  function setTodayToInputs() {
    const today = new Date();
    yearInput.value = today.getFullYear();
    monthInput.value = today.getMonth() + 1;
    dayInput.value = today.getDate();
  }

  function resetDayView(message = "Данных нет") {
    tableBody.innerHTML = "";
    totalToo.textContent = "—";
    totalGc.textContent = "—";
    avgCheck.textContent = "—";
    statusDiv.textContent = message;
  }

  function setHolidayUi(isHoliday, holidayName = "Праздничный день") {
    if (isHoliday) {
      holidayBadge.textContent = `Праздник: ${holidayName}`;
      holidayBadge.classList.add("is-holiday");
      toggleHolidayBtn.textContent = "Убрать праздничный день";
    } else {
      holidayBadge.textContent = "Обычный день";
      holidayBadge.classList.remove("is-holiday");
      toggleHolidayBtn.textContent = "Сделать праздничным";
    }
  }

  // ===== Current day holiday state =====
  async function loadCurrentHolidayState() {
    const { y, m, d } = getSelectedDateParts();

    if (!y || !m || !d) {
      currentHolidayRow = null;
      setHolidayUi(false);
      return;
    }

    const date = toISODate(y, m, d);

    const { data, error } = await supabaseClient
      .from("holiday_calendar")
      .select("*")
      .eq("holiday_date", date)
      .maybeSingle();

    if (error) {
      console.error(error);
      currentHolidayRow = null;
      setHolidayUi(false);
      return;
    }

    currentHolidayRow = data || null;

    if (data && data.is_active !== false) {
      setHolidayUi(true, data.holiday_name || "Праздничный день");
    } else {
      setHolidayUi(false);
    }
  }

  // ===== Load one day hourly plan =====
  async function loadDayPlan() {
    const { y, m, d } = getSelectedDateParts();

    if (!y || !m || !d) {
      resetDayView("Выбери дату");
      return;
    }

    const date = toISODate(y, m, d);

    statusDiv.textContent = "Загрузка...";

    const { data: run, error: runError } = await supabaseClient
      .from("plan_runs")
      .select("id")
      .eq("target_year", y)
      .eq("target_month", m)
      .maybeSingle();

    if (runError) {
      console.error(runError);
      resetDayView("Ошибка загрузки плана ❌");
      return;
    }

    if (!run) {
      resetDayView("План не найден ❌");
      await loadCurrentHolidayState();
      return;
    }

    const { data: rows, error } = await supabaseClient
      .from("plan_data")
      .select("*")
      .eq("plan_run_id", run.id)
      .eq("plan_date", date)
      .order("plan_hour", { ascending: true });

    if (error) {
      console.error(error);
      resetDayView("Ошибка ❌");
      await loadCurrentHolidayState();
      return;
    }

    if (!rows || !rows.length) {
      resetDayView("На выбранный день данных нет");
      await loadCurrentHolidayState();
      return;
    }

    tableBody.innerHTML = "";

    let sumToo = 0;
    let sumGc = 0;

    rows.forEach((r) => {
      const too = Number(r.too) || 0;
      const gc = Number(r.gc) || 0;
      const avg = gc ? too / gc : 0;

      sumToo += too;
      sumGc += gc;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${String(r.plan_hour).padStart(2, "0")}:00</td>
        <td>${format(too)}</td>
        <td>${format(gc)}</td>
        <td>${format(avg)}</td>
      `;
      tableBody.appendChild(tr);
    });

    totalToo.textContent = formatCurrency(sumToo);
    totalGc.textContent = format(sumGc);
    avgCheck.textContent = format(sumGc ? sumToo / sumGc : 0);

    statusDiv.textContent = "Готово ✅";
    await loadCurrentHolidayState();
  }

  // ===== Planning helpers (same logic as planning page) =====
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

  async function loadHolidayMap(targetYear, targetMonth) {
    const daysInMonth = getDaysInMonth(targetYear, targetMonth);
    const startDate = toISODate(targetYear, targetMonth, 1);
    const endDate = toISODate(targetYear, targetMonth, daysInMonth);

    const { data, error } = await supabaseClient
      .from("holiday_calendar")
      .select("holiday_date, holiday_name, impact_multiplier, is_active")
      .gte("holiday_date", startDate)
      .lte("holiday_date", endDate);

    if (error) {
      console.error(error);
      return new Map();
    }

    const holidayMap = new Map();

    for (const item of data || []) {
      if (item.is_active === false) continue;
      holidayMap.set(item.holiday_date, item);
    }

    return holidayMap;
  }

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
      throw new Error(`Не найден fact_upload за ${String(prev.month).padStart(2, "0")}.${prev.year}`);
    }

    return data[0];
  }

  function getDayType(dateInfo, holidayMap) {
    const dateObj = new Date(dateInfo.iso);
    const prevDate = new Date(dateObj);
    const nextDate = new Date(dateObj);

    prevDate.setDate(dateObj.getDate() - 1);
    nextDate.setDate(dateObj.getDate() + 1);

    const prevIso = toISODate(prevDate.getFullYear(), prevDate.getMonth() + 1, prevDate.getDate());
    const nextIso = toISODate(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate());

    if (holidayMap.has(dateInfo.iso)) return "holiday";
    if (holidayMap.has(nextIso)) return "pre_holiday";
    if (holidayMap.has(prevIso)) return "post_holiday";
    if ([0, 6].includes(dateInfo.weekdayNum)) return "weekend";

    return "weekday";
  }

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

  async function getExistingMonthlyTarget(planRunId) {
    const { data, error } = await supabaseClient
      .from("plan_data")
      .select("too")
      .eq("plan_run_id", planRunId);

    if (error) {
      throw new Error("Не удалось получить текущий месячный план");
    }

    return (data || []).reduce((sum, row) => sum + (Number(row.too) || 0), 0);
  }

  async function recalculateWholeMonthPlan(targetYear, targetMonth) {
    // 1. plan_run for selected month
    const { data: existingRun, error: runError } = await supabaseClient
      .from("plan_runs")
      .select("id")
      .eq("target_year", targetYear)
      .eq("target_month", targetMonth)
      .maybeSingle();

    if (runError) {
      throw new Error("Ошибка загрузки plan_run");
    }

    if (!existingRun) {
      throw new Error("Сначала сгенерируй и сохрани план на этот месяц");
    }

    // 2. current monthly target = current total from plan_data
    const monthlyTarget = await getExistingMonthlyTarget(existingRun.id);

    if (!monthlyTarget || monthlyTarget <= 0) {
      throw new Error("Не удалось определить месячный план");
    }

    // 3. settings + previous month source + holidays + fact
    const settings = await loadSettings();
    const upload = await findPreviousMonthUpload(targetYear, targetMonth);
    const holidayMap = settings.holiday_enabled
      ? await loadHolidayMap(targetYear, targetMonth)
      : new Map();

    const { data: factRows, error: factError } = await supabaseClient
      .from("fact_data")
      .select("fact_date, fact_hour, gc, too")
      .eq("upload_id", upload.id)
      .order("fact_date", { ascending: true })
      .order("fact_hour", { ascending: true });

    if (factError) {
      throw new Error("Ошибка загрузки fact_data");
    }

    if (!factRows || !factRows.length) {
      throw new Error("По предыдущему месяцу нет fact_data");
    }

    // 4. build monthly daily plans
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
        day_type: dayType,
        multiplier,
        weighted_plan: weightedPlan
      });
    }

    const rawTotal = rawDailyPlans.reduce((sum, d) => sum + d.weighted_plan, 0);
    const normalizeFactor = rawTotal > 0 ? monthlyTarget / rawTotal : 0;

    const generatedDailyPlans = rawDailyPlans.map((d) => ({
      ...d,
      final_plan: Math.round(d.weighted_plan * normalizeFactor)
    }));

    // 5. rebuild hourly plan for whole month
    const generatedHourlyPlans = [];

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
          plan_run_id: existingRun.id,
          plan_date: day.plan_date,
          plan_hour: hour,
          gc,
          too,
          weekday_num: day.weekday_num,
          day_type: day.day_type
        });
      }
    }

    // 6. replace old plan_data
    const { error: deleteError } = await supabaseClient
      .from("plan_data")
      .delete()
      .eq("plan_run_id", existingRun.id);

    if (deleteError) {
      throw new Error("Ошибка удаления старого plan_data");
    }

    const { error: insertError } = await supabaseClient
      .from("plan_data")
      .insert(generatedHourlyPlans);

    if (insertError) {
      console.error(insertError);
      throw new Error("Ошибка сохранения нового plan_data");
    }
  }

  // ===== Toggle holiday + full month recalculation =====
  async function toggleHolidayAndRecalculate() {
    const { y, m, d } = getSelectedDateParts();

    if (!y || !m || !d) {
      alert("Выбери дату");
      return;
    }

    const selectedDate = toISODate(y, m, d);

    try {
      toggleHolidayBtn.disabled = true;
      loadBtn.disabled = true;
      exportExcelBtn.disabled = true;

      statusDiv.textContent = "Обновление праздничного дня...";

      const settings = await loadSettings();
      const defaultMultiplier = Number(settings.holiday_multiplier) || 1.5;

      // если праздник уже есть и активен → выключаем
      if (currentHolidayRow && currentHolidayRow.is_active !== false) {
        const { error } = await supabaseClient
          .from("holiday_calendar")
          .update({ is_active: false })
          .eq("id", currentHolidayRow.id);

        if (error) {
          console.error(error);
          throw new Error("Не удалось убрать праздничный день");
        }
      } else {
        // если запись есть, но выключена → включаем
        if (currentHolidayRow && currentHolidayRow.id) {
          const { error } = await supabaseClient
            .from("holiday_calendar")
            .update({
              is_active: true,
              impact_multiplier: currentHolidayRow.impact_multiplier || defaultMultiplier,
              holiday_name: currentHolidayRow.holiday_name || "Праздничный день"
            })
            .eq("id", currentHolidayRow.id);

          if (error) {
            console.error(error);
            throw new Error("Не удалось включить праздничный день");
          }
        } else {
          // если записи нет → создаем
          const { error } = await supabaseClient
            .from("holiday_calendar")
            .insert({
              holiday_date: selectedDate,
              holiday_name: "Праздничный день",
              impact_multiplier: defaultMultiplier,
              is_active: true
            });

          if (error) {
            console.error(error);
            throw new Error("Не удалось создать праздничный день");
          }
        }
      }

      statusDiv.textContent = "Пересчет всего месяца...";

      await recalculateWholeMonthPlan(y, m);
      await loadDayPlan();

      statusDiv.textContent = "Месяц пересчитан и обновлен ✅";
    } catch (err) {
      console.error(err);
      statusDiv.textContent = `${err.message} ❌`;
    } finally {
      toggleHolidayBtn.disabled = false;
      loadBtn.disabled = false;
      exportExcelBtn.disabled = false;
    }
  }

  // ===== Excel export =====
  function exportTableToExcel() {
    const { y, m, d } = getSelectedDateParts();
    const monthStr = String(m).padStart(2, "0");
    const dayStr = String(d).padStart(2, "0");

    const table = document.getElementById("hourlyPlanTable");

    if (!table) {
      alert("Таблица табылмады");
      return;
    }

    const workbook = XLSX.utils.table_to_book(table, { sheet: "План" });
    const fileName = `plan_${y}-${monthStr}-${dayStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  }

  // ===== Events =====
  loadBtn.addEventListener("click", loadDayPlan);
  toggleHolidayBtn.addEventListener("click", toggleHolidayAndRecalculate);
  exportExcelBtn.addEventListener("click", exportTableToExcel);

  yearInput.addEventListener("change", loadDayPlan);
  monthInput.addEventListener("change", loadDayPlan);
  dayInput.addEventListener("change", loadDayPlan);

  // ===== Init =====
  setTodayToInputs();
  loadDayPlan();
})();