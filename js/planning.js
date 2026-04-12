(() => {
  const supabaseClient = window.supabase.createClient(
    "https://hpmocpehjdknsffilyee.supabase.co",
    "sb_publishable_8Pmmrw0lBWiMx5n6RwaK9w_z4-FKIFF"
  );

  const targetYearInput = document.getElementById("targetYear");
  const targetMonthInput = document.getElementById("targetMonth");
  const monthlyTargetInput = document.getElementById("monthlyTarget");
  const sourceUploadSelect = document.getElementById("sourceUpload");

  const loadSourcesBtn = document.getElementById("loadSourcesBtn");
  const generateBtn = document.getElementById("generateBtn");
  const saveBtn = document.getElementById("saveBtn");
  const statusDiv = document.getElementById("status");

  const summaryMonth = document.getElementById("summaryMonth");
  const summaryTarget = document.getElementById("summaryTarget");
  const summaryDays = document.getElementById("summaryDays");
  const summaryHours = document.getElementById("summaryHours");

  const dailyPlanBody = document.getElementById("dailyPlanBody");

  const WEEKDAY_NAMES = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота"
  ];

  let generatedDailyPlans = [];
  let generatedHourlyPlans = [];

  function formatCurrency(value) {
    return new Intl.NumberFormat("ru-RU").format(Math.round(value)) + " ₸";
  }

  function formatMonthLabel(year, month) {
    return `${String(month).padStart(2, "0")}.${year}`;
  }

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

  async function loadFactSources() {
    statusDiv.textContent = "Загрузка источников...";

    const { data, error } = await supabaseClient
      .from("fact_uploads")
      .select("id, file_name, period_year, period_month, uploaded_at")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error(error);
      statusDiv.textContent = "Ошибка загрузки источников ❌";
      return;
    }

    sourceUploadSelect.innerHTML = "";

    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.file_name} — ${item.period_month}.${item.period_year}`;
      sourceUploadSelect.appendChild(option);
    });

    statusDiv.textContent = data.length
      ? "Источники загружены"
      : "Нет загруженных источников";
  }

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
      result.set(weekdayNum, value.sumToo / value.count);
    }

    return result;
  }

  function buildSameDayMap(dailyTotals) {
    const result = new Map();

    for (const item of dailyTotals) {
      const dayNum = Number(item.fact_date.slice(8, 10));
      result.set(dayNum, item.total_too);
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
        const avgCheck =
          bucket.totalGc > 0 ? bucket.totalToo / bucket.totalGc : 0;

        avgCheckMap.set(hour, avgCheck);
      }

      result.set(weekdayNum, avgCheckMap);
    }

    return result;
  }

  async function generatePlan() {
  const uploadId = sourceUploadSelect.value;
  const targetYear = Number(targetYearInput.value);
  const targetMonth = Number(targetMonthInput.value);
  const monthlyTarget = Number(monthlyTargetInput.value);

  if (!uploadId) {
    alert("Источник факта таңдалмады");
    return;
  }

  if (!monthlyTarget || monthlyTarget <= 0) {
    alert("План на месяц енгіз");
    return;
  }

  // 🔥 SETTINGS ЖҮКТЕУ
  const { data: settings, error: settingsError } = await supabaseClient
    .from("app_settings")
    .select("*")
    .limit(1)
    .single();

  if (settingsError || !settings) {
    console.error(settingsError);
    statusDiv.textContent = "Ошибка настроек ❌";
    return;
  }

  console.log("SETTINGS:", settings);

  statusDiv.textContent = "Загрузка fact_data...";

  const { data: factRows, error } = await supabaseClient
    .from("fact_data")
    .select("fact_date, fact_hour, gc, too")
    .eq("upload_id", uploadId)
    .order("fact_date", { ascending: true })
    .order("fact_hour", { ascending: true });

  if (error) {
    console.error(error);
    statusDiv.textContent = "Ошибка загрузки факта ❌";
    return;
  }

  const dailyTotals = groupDailyTotals(factRows);
  const weekdayAverages = buildWeekdayAverages(dailyTotals);
  const sameDayMap = buildSameDayMap(dailyTotals);
  const hourlyShares = buildHourlyWeekdayShares(factRows);
  const hourlyAvgChecks = buildHourlyWeekdayAvgChecks(factRows);

  const daysInMonth = getDaysInMonth(targetYear, targetMonth);
  const rawDailyPlans = [];

  // 🔥 КҮНДІК ПЛАН (SETTINGS-ПЕН)
  for (let day = 1; day <= daysInMonth; day++) {
    const dateInfo = getDateInfo(targetYear, targetMonth, day);

    const sameDayValue = sameDayMap.get(day) || 0;
    const weekdayAvg = weekdayAverages.get(dateInfo.weekdayNum) || 0;

    const basePlan =
      (sameDayValue * settings.same_day_weight) +
      (weekdayAvg * settings.weekday_avg_weight);

    rawDailyPlans.push({
      plan_date: dateInfo.iso,
      weekday_num: dateInfo.weekdayNum,
      weekday_name: dateInfo.weekdayName,
      base_plan: basePlan,
      final_plan: 0
    });
  }

  const rawTotal = rawDailyPlans.reduce((sum, d) => sum + d.base_plan, 0);
  const normalizeFactor = rawTotal > 0 ? monthlyTarget / rawTotal : 0;

  generatedDailyPlans = rawDailyPlans.map(d => ({
    ...d,
    final_plan: Math.round(d.base_plan * normalizeFactor)
  }));

  // 🔥 ПОЧАСОВОЙ ПЛАН
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

      // 🔥 GC SETTINGS
      let gc;

      if (settings.gc_mode === "fixed") {
        gc = Math.round(too / settings.default_avg_check);
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
        day_type: [0, 6].includes(day.weekday_num) ? "weekend" : "normal"
      });
    }
  }

  renderDailyPlans(targetYear, targetMonth, monthlyTarget);
  statusDiv.textContent = "План сгенерирован ✅";
}

  function renderDailyPlans(targetYear, targetMonth, monthlyTarget) {
    dailyPlanBody.innerHTML = "";

    generatedDailyPlans.forEach((day) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${day.plan_date}</td>
        <td>${day.weekday_name}</td>
        <td>${formatCurrency(day.base_plan)}</td>
        <td>${formatCurrency(day.final_plan)}</td>
      `;
      dailyPlanBody.appendChild(tr);
    });

    summaryMonth.textContent = formatMonthLabel(targetYear, targetMonth);
    summaryTarget.textContent = formatCurrency(monthlyTarget);
    summaryDays.textContent = String(generatedDailyPlans.length);
    summaryHours.textContent = String(generatedHourlyPlans.length);
  }

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
      .insert({
        target_year: targetYear,
        target_month: targetMonth,
        use_prev_month: true,
        use_same_month_last_year: false,
        prev_month_weight: 0.7,
        last_year_weight: 0.3
      })
      .select()
      .single();

    if (runError) {
      console.error(runError);
      statusDiv.textContent = "Ошибка сохранения run ❌";
      return;
    }

    const planRunId = runData.id;

    const planRows = generatedHourlyPlans.map((row) => ({
      plan_run_id: planRunId,
      plan_date: row.plan_date,
      plan_hour: row.plan_hour,
      gc: row.gc,
      too: row.too,
      weekday_num: row.weekday_num,
      day_type: row.day_type
    }));

    statusDiv.textContent = "Сохранение plan_data...";

    const { error: dataError } = await supabaseClient
      .from("plan_data")
      .insert(planRows);

    if (dataError) {
      console.error(dataError);
      statusDiv.textContent = "Ошибка сохранения plan_data ❌";
      return;
    }

    statusDiv.textContent = "План сохранен в базу ✅";
  }

  loadSourcesBtn.addEventListener("click", loadFactSources);
  generateBtn.addEventListener("click", generatePlan);
  saveBtn.addEventListener("click", savePlan);

  loadFactSources();
})();