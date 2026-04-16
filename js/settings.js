// Подключение к Supabase
const supabaseClient = window.supabase.createClient(
  "https://hpmocpehjdknsffilyee.supabase.co",
  "sb_publishable_8Pmmrw0lBWiMx5n6RwaK9w_z4-FKIFF"
);

// Основные настройки
const planningMode = document.getElementById("planningMode");

// Настройки GC
const gcMode = document.getElementById("gcMode");
const avgCheck = document.getElementById("avgCheck");

// Коэффициенты дней
const weekdayMultiplier = document.getElementById("weekdayMultiplier");
const weekendMultiplier = document.getElementById("weekendMultiplier");

// Праздничные дни
const holidayEnabled = document.getElementById("holidayEnabled");
const holidayMultiplier = document.getElementById("holidayMultiplier");
const preHolidayMultiplier = document.getElementById("preHolidayMultiplier");
const postHolidayMultiplier = document.getElementById("postHolidayMultiplier");

// Кнопка и статус
const saveBtn = document.getElementById("saveBtn");
const statusDiv = document.getElementById("status");

// ID строки настроек
let settingsId = null;

/**
 * Загрузка настроек из app_settings
 */
async function loadSettings() {
  statusDiv.textContent = "Загрузка настроек...";

  const { data, error } = await supabaseClient
    .from("app_settings")
    .select("*")
    .limit(1)
    .single();

  if (error || !data) {
    console.error("Ошибка загрузки настроек:", error);
    statusDiv.textContent = "Ошибка загрузки настроек ❌";
    return;
  }

  settingsId = data.id;

  // Основные
  planningMode.value = data.planning_mode || "prev_month_only";

  // GC
  gcMode.value = data.gc_mode || "historical";
  avgCheck.value = data.default_avg_check ?? 0;

  // День / выходной
  weekdayMultiplier.value = data.weekday_multiplier ?? 1;
  weekendMultiplier.value = data.weekend_multiplier ?? 1;

  // Праздники
  holidayEnabled.value = String(data.holiday_enabled ?? true);
  holidayMultiplier.value = data.holiday_multiplier ?? 1.2;
  preHolidayMultiplier.value = data.pre_holiday_multiplier ?? 1;
  postHolidayMultiplier.value = data.post_holiday_multiplier ?? 1;

  statusDiv.textContent = "Настройки загружены ✅";
}

/**
 * Сохранение настроек в app_settings
 */
async function saveSettings() {
  if (!settingsId) {
    statusDiv.textContent = "ID настроек не найден ❌";
    return;
  }

  statusDiv.textContent = "Сохранение...";

  const payload = {
    planning_mode: planningMode.value,
    gc_mode: gcMode.value,
    default_avg_check: Number(avgCheck.value) || 0,
    weekday_multiplier: Number(weekdayMultiplier.value) || 1,
    weekend_multiplier: Number(weekendMultiplier.value) || 1,
    holiday_enabled: holidayEnabled.value === "true",
    holiday_multiplier: Number(holidayMultiplier.value) || 1,
    pre_holiday_multiplier: Number(preHolidayMultiplier.value) || 1,
    post_holiday_multiplier: Number(postHolidayMultiplier.value) || 1
  };

  const { error } = await supabaseClient
    .from("app_settings")
    .update(payload)
    .eq("id", settingsId);

  if (error) {
    console.error("Ошибка сохранения:", error);
    statusDiv.textContent = "Ошибка сохранения ❌";
    return;
  }

  statusDiv.textContent = "Сохранено ✅";
}

// Кнопка сохранить
saveBtn.addEventListener("click", saveSettings);

// Автозагрузка настроек при открытии страницы
loadSettings();