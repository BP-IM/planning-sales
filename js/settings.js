const supabaseClient = window.supabase.createClient(
  "https://hpmocpehjdknsffilyee.supabase.co",
  "sb_publishable_8Pmmrw0lBWiMx5n6RwaK9w_z4-FKIFF"
);

const sameDay = document.getElementById("sameDay");
const weekdayAvg = document.getElementById("weekdayAvg");

const prevWeight = document.getElementById("prevWeight");
const lastYearWeight = document.getElementById("lastYearWeight");

const gcMode = document.getElementById("gcMode");
const avgCheck = document.getElementById("avgCheck");

const saveBtn = document.getElementById("saveBtn");
const statusDiv = document.getElementById("status");

let settingsId = null;

async function loadSettings() {
  const { data } = await supabaseClient
    .from("app_settings")
    .select("*")
    .limit(1)
    .single();

  settingsId = data.id;

  sameDay.value = data.same_day_weight;
  weekdayAvg.value = data.weekday_avg_weight;

  prevWeight.value = data.prev_month_weight;
  lastYearWeight.value = data.last_year_weight;

  gcMode.value = data.gc_mode;
  avgCheck.value = data.default_avg_check;
}

async function saveSettings() {
  const { error } = await supabaseClient
    .from("app_settings")
    .update({
      same_day_weight: Number(sameDay.value),
      weekday_avg_weight: Number(weekdayAvg.value),
      prev_month_weight: Number(prevWeight.value),
      last_year_weight: Number(lastYearWeight.value),
      gc_mode: gcMode.value,
      default_avg_check: Number(avgCheck.value)
    })
    .eq("id", settingsId);

  if (error) {
    statusDiv.textContent = "Ошибка ❌";
    return;
  }

  statusDiv.textContent = "Сохранено ✅";
}

saveBtn.addEventListener("click", saveSettings);

loadSettings();