(() => {
  const supabaseClient = window.supabase.createClient(
    "https://hpmocpehjdknsffilyee.supabase.co",
    "sb_publishable_8Pmmrw0lBWiMx5n6RwaK9w_z4-FKIFF"
  );

  const fileInput = document.getElementById("fileInput");
  const parseBtn = document.getElementById("parseBtn");
  const uploadBtn = document.getElementById("uploadBtn");
  const previewBody = document.getElementById("previewBody");
  const statusDiv = document.getElementById("status");

  let parsedRows = [];
  let detectedYear = null;
  let detectedMonth = null;

  function toISODate(value) {
    if (!value) return null;

    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    if (typeof value === "string") {
      const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
    }

    return null;
  }

  parseBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) return alert("Файл таңда!");

    parsedRows = [];
    previewBody.innerHTML = "";
    statusDiv.textContent = "Чтение файла...";

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });

      const sheet =
        workbook.Sheets["Почасовой ТО"] ||
        workbook.Sheets[workbook.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
        raw: true
      });

      let currentDate = null;

      for (let i = 5; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const colA = row[0];
        const colB = row[1];
        const colC = row[2];
        const colD = row[3];

        if (colA) {
          const iso = toISODate(colA);
          if (iso) {
            currentDate = iso;

            // жыл/ай анықтаймыз
            const d = new Date(iso);
            detectedYear = d.getFullYear();
            detectedMonth = d.getMonth() + 1;
          }
        }

        if (!currentDate) continue;
        if (colB === null || colB === "") continue;

        const hour = Number(colB);
        if (isNaN(hour)) continue;

        parsedRows.push({
          fact_date: currentDate,
          fact_hour: hour,
          gc: Number(colC) || 0,
          too: Number(colD) || 0
        });
      }

      parsedRows.sort((a, b) => {
        if (a.fact_date === b.fact_date) return a.fact_hour - b.fact_hour;
        return a.fact_date.localeCompare(b.fact_date);
      });

      parsedRows.slice(0, 100).forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.fact_date}</td>
          <td>${String(r.fact_hour).padStart(2, "0")}:00</td>
          <td>${r.too.toLocaleString("ru-RU")}</td>
          <td>${r.gc}</td>
        `;
        previewBody.appendChild(tr);
      });

      statusDiv.textContent = `Найдено строк: ${parsedRows.length}`;
    } catch (err) {
      console.error(err);
      statusDiv.textContent = "Ошибка чтения файла ❌";
    }
  });

  uploadBtn.addEventListener("click", async () => {
    if (!parsedRows.length) {
      alert("Сначала прочитай файл!");
      return;
    }

    statusDiv.textContent = "Создание upload...";

    try {
      // 1️⃣ upload запись
      const { data: uploadData, error: uploadError } = await supabaseClient
  .from("fact_uploads")
  .insert({
    file_name: fileInput.files[0].name,
    source_kind: "manual",
    period_year: detectedYear,
    period_month: detectedMonth
  })
  .select()
  .single();

      if (uploadError) {
        console.error(uploadError);
        statusDiv.textContent = "Ошибка upload ❌";
        return;
      }

      const uploadId = uploadData.id;

      // 2️⃣ rows-қа upload_id қосамыз
      const rowsWithUpload = parsedRows.map((row) => ({
        ...row,
        upload_id: uploadId
      }));

      statusDiv.textContent = "Загрузка данных...";

      // 3️⃣ insert факттар
      const { error } = await supabaseClient
        .from("fact_data")
        .insert(rowsWithUpload);

      if (error) {
        console.error(error);
        statusDiv.textContent = "Ошибка загрузки ❌";
        return;
      }

      statusDiv.textContent = `Успешно загружено ${rowsWithUpload.length} строк ✅`;
    } catch (err) {
      console.error(err);
      statusDiv.textContent = "Ошибка ❌";
    }
  });
})();