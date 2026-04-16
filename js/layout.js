const sidebar = document.getElementById("sidebar");

const menu = [
  { name: "Dashboard", path: "index.html" },
  { name: "Импорт данных", path: "import.html" },
  { name: "Планирование", path: "planning.html" },
  { name: "План по дням", path: "calendar.html" },
  { name: "Настройки", path: "settings.html" }
];

function renderSidebar() {
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  sidebar.innerHTML = `
    <div class="sidebar-top">
      <div class="logo">
        <span class="logo-text">Planning</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      ${menu
        .map((item) => {
          const isActive = item.path === currentPath ? "active" : "";
          return `
            <a href="${item.path}" class="${isActive}" title="${item.name}">
              <span class="nav-text">${item.name}</span>
            </a>
          `;
        })
        .join("")}
    </nav>
  `;
}

renderSidebar();

sidebar.addEventListener("mouseenter", () => {
  document.body.classList.add("sidebar-open");
});

sidebar.addEventListener("mouseleave", () => {
  document.body.classList.remove("sidebar-open");
});