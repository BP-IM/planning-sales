(() => {
  const supabaseClient = window.supabase.createClient(
    "https://hpmocpehjdknsffilyee.supabase.co",
    "sb_publishable_8Pmmrw0lBWiMx5n6RwaK9w_z4-FKIFF"
  );

  const yearInput = document.getElementById("year");
  const monthInput = document.getElementById("month");
  const dayInput = document.getElementById("day");

  const loadBtn = document.getElementById("loadBtn");

  const tableBody = document.getElementById("tableBody");
  const totalToo = document.getElementById("totalToo");
  const totalGc = document.getElementById("totalGc");
  const avgCheck = document.getElementById("avgCheck");

  const statusDiv = document.getElementById("status");

  function format(num) {
    return new Intl.NumberFormat("ru-RU").format(Math.round(Number(num) || 0));
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

  async function loadDayPlan() {
    const y = Number(yearInput.value);
    const m = Number(monthInput.value);
    const d = Number(dayInput.value);

    if (!y || !m || !d) {
      resetDayView("Выбери дату");
      return;
    }

    const monthStr = String(m).padStart(2, "0");
    const dayStr = String(d).padStart(2, "0");
    const date = `${y}-${monthStr}-${dayStr}`;

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
      return;
    }

    if (!rows || !rows.length) {
      resetDayView("На выбранный день данных нет");
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

    totalToo.textContent = format(sumToo) + " ₸";
    totalGc.textContent = format(sumGc);
    avgCheck.textContent = format(sumGc ? sumToo / sumGc : 0);

    statusDiv.textContent = "Готово ✅";
  }

  loadBtn.addEventListener("click", loadDayPlan);
  yearInput.addEventListener("change", loadDayPlan);
  monthInput.addEventListener("change", loadDayPlan);
  dayInput.addEventListener("change", loadDayPlan);

  setTodayToInputs();
  loadDayPlan();
})();

/* екзель жскод */
const yearInput = document.getElementById("year");
const monthInput = document.getElementById("month");
const dayInput = document.getElementById("day");
const exportExcelBtn = document.getElementById("exportExcelBtn");

function exportTableToExcel() {
  const y = yearInput.value;
  const m = String(monthInput.value).padStart(2, "0");
  const d = String(dayInput.value).padStart(2, "0");

  const table = document.getElementById("hourlyPlanTable");

  if (!table) {
    alert("Таблица табылмады");
    return;
  }

  const workbook = XLSX.utils.table_to_book(table, { sheet: "План" });
  const fileName = `plan_${y}-${m}-${d}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}

if (exportExcelBtn) {
  exportExcelBtn.addEventListener("click", exportTableToExcel);
}