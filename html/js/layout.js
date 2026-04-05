async function loadPartial(selector, filePath) {
  const target = document.querySelector(selector);
  if (!target) return;

  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load: ${filePath}`);
    }
    const html = await response.text();
    target.innerHTML = html;
  } catch (error) {
    console.error(error);
  }
}

function bindMobileMenu() {
  const menuBtn = document.getElementById("menuBtn");
  const mobileMenu = document.getElementById("mobileMenu");

  if (!menuBtn || !mobileMenu) return;

  menuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    mobileMenu.classList.toggle("active");
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileMenu.classList.remove("active");
    });
  });

  document.addEventListener("click", function (e) {
    if (!mobileMenu.contains(e.target) && !menuBtn.contains(e.target)) {
      mobileMenu.classList.remove("active");
    }
  });
}

function bindSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      const header = document.querySelector(".topbar");
      const headerHeight = header ? header.offsetHeight : 0;
      const extraOffset = window.innerWidth <= 700 ? 16 : 22;
      const targetTop =
        target.getBoundingClientRect().top +
        window.pageYOffset -
        headerHeight -
        extraOffset;

      window.scrollTo({
        top: targetTop,
        behavior: "smooth"
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  await loadPartial("#site-header", "./components/header.html");
  await loadPartial("#site-footer", "./components/footer.html");

  bindMobileMenu();
  bindSmoothScroll();
});
