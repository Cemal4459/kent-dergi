(() => {
  const toggle = document.querySelector("[data-nav-toggle]");
  const mobile = document.querySelector("[data-mobile-nav]");
  if (!toggle || !mobile) return;

  toggle.addEventListener("click", () => {
    const open = mobile.style.display === "block";
    mobile.style.display = open ? "none" : "block";
  });

  // Menü linkine tıklayınca kapansın
  mobile.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => (mobile.style.display = "none"));
  });
})();
