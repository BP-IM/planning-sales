(() => {
  const supabaseClient = window.supabase.createClient(
    "https://hpmocpehjdknsffilyee.supabase.co",
    "sb_publishable_8Pmmrw0lBWiMx5n6RwaK9w_z4-FKIFF"
  );

  const MONTH_NAMES = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];

  const DAY_NAMES = [
    "Воскресенье", "Понедельник", "Вторник",
    "Среда", "Четверг", "Пятница", "Суббота"
  ];

  const currentMonthLabel = document.getElementById("currentMonthLabel");
  const monthBadge = document.getElementById("monthBadge");
  const monthlyPlan = document.getElementById("monthlyPlan");
  const avgCheck = document.getElementById("avgCheck");
  const monthlyGuests = document.getElementById("monthlyGuests");
  const dailyAverage = document.getElementById("dailyAverage");
  const planTableBody = document.getElementById("planTableBody");

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  function formatCurrency(value) {
    return new Intl.NumberFormat("ru-RU").format(Math.round(value)) + " ₸";
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ru-RU").format(Math.round(value));
  }

  function formatMonthText(year, month) {
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }

  function renderEmptyState(message) {
    const monthText = formatMonthText(currentYear, currentMonth);

    currentMonthLabel.textContent = `Автоматический план на ${monthText}`;
    monthBadge.textContent = monthText;
    monthlyPlan.textContent = "0 ₸";
    avgCheck.textContent = "0 ₸";
    monthlyGuests.textContent = "0";
    dailyAverage.textContent = "0 ₸";

    planTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; color:#64748b; padding:24px;">
          ${message}
        </td>
      </tr>
    `;
  }

  function groupDailyPlans(rows) {
    const dailyMap = new Map();

    for (const row of rows) {
      const key = row.plan_date;

      if (!dailyMap.has(key)) {
        const dateObj = new Date(row.plan_date);
        dailyMap.set(key, {
          plan_date: row.plan_date,
          day: Number(row.plan_date.slice(8, 10)),
          day_of_week: dateObj.getDay(),
          too: 0,
          gc: 0
        });
      }

      const current = dailyMap.get(key);
      current.too += Number(row.too) || 0;
      current.gc += Number(row.gc) || 0;
    }

    return Array.from(dailyMap.values()).sort((a, b) =>
      a.plan_date.localeCompare(b.plan_date)
    );
  }

  function renderSummary(year, month, dailyPlans) {
    const monthText = formatMonthText(year, month);
    const totalToo = dailyPlans.reduce((sum, item) => sum + item.too, 0);
    const totalGc = dailyPlans.reduce((sum, item) => sum + item.gc, 0);
    const avgPerDay = dailyPlans.length ? totalToo / dailyPlans.length : 0;
    const avgCheckValue = totalGc > 0 ? totalToo / totalGc : 0;

    currentMonthLabel.textContent = `Автоматический план на ${monthText}`;
    monthBadge.textContent = monthText;
    monthlyPlan.textContent = formatCurrency(totalToo);
    avgCheck.textContent = formatCurrency(avgCheckValue);
    monthlyGuests.textContent = formatNumber(totalGc);
    dailyAverage.textContent = formatCurrency(avgPerDay);
  }

  function renderTable(dailyPlans) {
    planTableBody.innerHTML = "";

    dailyPlans.forEach((item) => {
      const tr = document.createElement("tr");

      if (item.day_of_week === 0 || item.day_of_week === 6) {
        tr.classList.add("weekend");
      }

      tr.innerHTML = `
        <td>${item.day}</td>
        <td class="day-name">${DAY_NAMES[item.day_of_week]}</td>
        <td class="amount">${formatCurrency(item.too)}</td>
        <td class="guests">${formatNumber(item.gc)}</td>
      `;

      planTableBody.appendChild(tr);
    });
  }

  async function loadDashboard() {
    const monthText = formatMonthText(currentYear, currentMonth);
    currentMonthLabel.textContent = `Автоматический план на ${monthText}`;
    monthBadge.textContent = monthText;

    const { data: runData, error: runError } = await supabaseClient
      .from("plan_runs")
      .select("id, created_at")
      .eq("target_year", currentYear)
      .eq("target_month", currentMonth)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (runError || !runData) {
      console.error(runError);
      renderEmptyState("На текущий месяц план пока не найден");
      return;
    }

    const { data: planRows, error: planError } = await supabaseClient
      .from("plan_data")
      .select("plan_date, plan_hour, too, gc")
      .eq("plan_run_id", runData.id)
      .order("plan_date", { ascending: true })
      .order("plan_hour", { ascending: true });

    if (planError) {
      console.error(planError);
      renderEmptyState("Ошибка загрузки плана");
      return;
    }

    if (!planRows || !planRows.length) {
      renderEmptyState("По выбранному плану нет данных");
      return;
    }

    const dailyPlans = groupDailyPlans(planRows);

    renderSummary(currentYear, currentMonth, dailyPlans);
    renderTable(dailyPlans);
  }

  loadDashboard();
})();