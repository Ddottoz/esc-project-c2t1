(() => {
  const submissionPage = document.getElementById("submission-page");

  const sidebarToggle = document.getElementById("sidebar-toggle");


  sidebarToggle.addEventListener(
    "click",
    () => {
      submissionPage.classList.toggle("sidebar-collapsed");
    }
  );
})();