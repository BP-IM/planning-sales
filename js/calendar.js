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
    return new Intl.NumberFormat("ru-RU").format(Math.round(num));
  }

  async function loadDayPlan() {
    const y = yearInput.value;
    const m = String(monthInput.value).padStart(2, "0");
    const d = String(dayInput.value).padStart(2, "0");

    const date = `${y}-${m}-${d}`;

    statusDiv.textContent = "Загрузка...";

    // соңғы run аламыз
    const { data: run } = await supabaseClient
      .from("plan_runs")
      .select("id")
      .eq("target_year", Number(y))
      .eq("target_month", Number(m))
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!run) {
      statusDiv.textContent = "План не найден ❌";
      return;
    }

    const { data: rows, error } = await supabaseClient
      .from("plan_data")
      .select("*")
      .eq("plan_run_id", run.id)
      .eq("plan_date", date)
      .order("plan_hour");

    if (error) {
      console.error(error);
      statusDiv.textContent = "Ошибка ❌";
      return;
    }

    tableBody.innerHTML = "";

    let sumToo = 0;
    let sumGc = 0;

    rows.forEach(r => {
      const avg = r.gc ? r.too / r.gc : 0;

      sumToo += r.too;
      sumGc += r.gc;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${String(r.plan_hour).padStart(2, "0")}:00</td>
        <td>${format(r.too)}</td>
        <td>${format(r.gc)}</td>
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
})();
/*екзель жскод*/
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

exportExcelBtn.addEventListener("click", exportTableToExcel);