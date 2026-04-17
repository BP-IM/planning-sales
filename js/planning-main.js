const supabaseClient = window.supabase.createClient(
  "https://hpmocpehjdknsffilyee.supabase.co",
  "sb_publishable_8Pmmrw0lBWiMx5n6RwaK9w_z4-FKIFF"
);

// ===== Inputs =====
const targetYearInput = document.getElementById("targetYear");
const targetMonthInput = document.getElementById("targetMonth");
const monthlyTargetInput = document.getElementById("monthlyTarget");
const sourceInfoInput = document.getElementById("sourceInfo");

const generateBtn = document.getElementById("generateBtn");
const saveBtn = document.getElementById("saveBtn");
const statusDiv = document.getElementById("status");

// ===== Summary =====
const summaryMonth = document.getElementById("summaryMonth");
const summarySource = document.getElementById("summarySource");
const summaryTarget = document.getElementById("summaryTarget");
const summaryDays = document.getElementById("summaryDays");
const summaryHours = document.getElementById("summaryHours");

// ===== Table =====
const dailyPlanBody = document.getElementById("dailyPlanBody");

// ===== Holiday modal =====
const openHolidayModalBtn = document.getElementById("openHolidayModalBtn");
const closeHolidayModalBtn = document.getElementById("closeHolidayModalBtn");
const holidayModal = document.getElementById("holidayModal");

const holidayPrevBtn = document.getElementById("holidayPrevBtn");
const holidayNextBtn = document.getElementById("holidayNextBtn");
const holidayMonthLabel = document.getElementById("holidayMonthLabel");
const holidayDays = document.getElementById("holidayDays");
const saveHolidaysBtn = document.getElementById("saveHolidaysBtn");
const holidayStatus = document.getElementById("holidayStatus");

// ===== Global state =====
let generatedDailyPlans = [];
let generatedHourlyPlans = [];
let generatedSourceLabel = "";

let holidayCalendarYear = Number(targetYearInput?.value) || new Date().getFullYear();
let holidayCalendarMonth = Number(targetMonthInput?.value) || new Date().getMonth() + 1;

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

// ===== UI helpers =====
function openHolidayModal() {
  holidayModal?.classList.remove("hidden");
}

function closeHolidayModal() {
  holidayModal?.classList.add("hidden");
}

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

function resetPlanView(message = "Сохраненный план не найден") {
  if (dailyPlanBody) dailyPlanBody.innerHTML = "";
  if (summaryMonth) summaryMonth.textContent = "—";
  if (summarySource) summarySource.textContent = "—";
  if (summaryTarget) summaryTarget.textContent = "—";
  if (summaryDays) summaryDays.textContent = "—";
  if (summaryHours) summaryHours.textContent = "—";

  generatedDailyPlans = [];
  generatedHourlyPlans = [];
  generatedSourceLabel = "";

  if (statusDiv) statusDiv.textContent = message;
}

// ===== Holiday modal events =====
openHolidayModalBtn?.addEventListener("click", async () => {
  holidayCalendarYear = Number(targetYearInput.value);
  holidayCalendarMonth = Number(targetMonthInput.value);

  await loadSelectedHolidaysForMonth(holidayCalendarYear, holidayCalendarMonth);
  openHolidayModal();
});

closeHolidayModalBtn?.addEventListener("click", closeHolidayModal);
holidayModal?.querySelector(".holiday-modal-backdrop")?.addEventListener("click", closeHolidayModal);

holidayPrevBtn?.addEventListener("click", async () => {
  holidayCalendarMonth -= 1;

  if (holidayCalendarMonth < 1) {
    holidayCalendarMonth = 12;
    holidayCalendarYear -= 1;
  }

  await loadSelectedHolidaysForMonth(holidayCalendarYear, holidayCalendarMonth);
});

holidayNextBtn?.addEventListener("click", async () => {
  holidayCalendarMonth += 1;

  if (holidayCalendarMonth > 12) {
    holidayCalendarMonth = 1;
    holidayCalendarYear += 1;
  }

  await loadSelectedHolidaysForMonth(holidayCalendarYear, holidayCalendarMonth);
});

saveHolidaysBtn?.addEventListener("click", async () => {
  await saveSelectedHolidays();

  // после сохранения синхронизируем календарь с текущими input
  holidayCalendarYear = Number(targetYearInput.value);
  holidayCalendarMonth = Number(targetMonthInput.value);

  await loadSelectedHolidaysForMonth(holidayCalendarYear, holidayCalendarMonth);
});

// ===== Main actions =====
generateBtn?.addEventListener("click", generatePlan);
saveBtn?.addEventListener("click", savePlan);

// ===== Inputs change =====
targetYearInput?.addEventListener("change", async () => {
  updateSourceInfoLabel();

  holidayCalendarYear = Number(targetYearInput.value);
  holidayCalendarMonth = Number(targetMonthInput.value);

  await loadSelectedHolidaysForMonth(holidayCalendarYear, holidayCalendarMonth);
  await loadSavedPlan();
});

targetMonthInput?.addEventListener("change", async () => {
  updateSourceInfoLabel();

  holidayCalendarYear = Number(targetYearInput.value);
  holidayCalendarMonth = Number(targetMonthInput.value);

  await loadSelectedHolidaysForMonth(holidayCalendarYear, holidayCalendarMonth);
  await loadSavedPlan();
});

// ===== Init =====
(async () => {
  updateSourceInfoLabel();

  holidayCalendarYear = Number(targetYearInput.value);
  holidayCalendarMonth = Number(targetMonthInput.value);

  await loadSelectedHolidaysForMonth(holidayCalendarYear, holidayCalendarMonth);
  await loadSavedPlan();
})();