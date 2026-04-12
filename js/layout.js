const sidebar = document.getElementById("sidebar");

const menu = [
  { name: "Dashboard", path: "dashboard.html" },
  { name: "Импорт данных", path: "import.html" },
  { name: "Планирование", path: "planning.html" },
  { name: "План по дням", path: "calendar.html" },
  { name: "Настройки", path: "settings.html" }
];

function renderSidebar() {
  const currentPath = window.location.pathname.split("/").pop();

  sidebar.innerHTML = `
    <div class="logo">📊 Planning</div>

    <nav class="sidebar-nav">
      ${menu
        .map((item) => {
          const isActive = item.path === currentPath ? "active" : "";
          return `<a href="${item.path}" class="${isActive}">${item.name}</a>`;
        })
        .join("")}
    </nav>
  `;
}

renderSidebar();