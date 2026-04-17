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