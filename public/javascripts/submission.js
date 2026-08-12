(() => {
  const submissionPage = document.getElementById("submission-page");

  const sidebarToggle = document.getElementById("sidebar-toggle");

  if (sidebarToggle) {
    sidebarToggle.addEventListener(
      "click",
      () => {
        submissionPage.classList.toggle("sidebar-collapsed");
      }
    );
  }

  const tableBody = document.querySelector(".submission-table tbody");
  const sortButtons = document.querySelectorAll(".submission-sort-button");

  function compareValues(left, right, type) {
    if (type === "number") {
      return Number(left) - Number(right);
    }

    return left.localeCompare(right, "en-SG", {numeric: true, sensitivity: "base"});
  }

  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sortKey;
      const type = button.dataset.sortType;
      const header = button.closest("th");
      const direction = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      const multiplier = direction === "ascending" ? 1 : -1;
      const rows = Array.from(tableBody.querySelectorAll(".submission-row"));
      const dataKey = `sort${key[0].toUpperCase()}${key.slice(1)}`;

      rows.sort((leftRow, rightRow) => {
        const leftValue = leftRow.querySelector(`[data-sort-${key}]`).dataset[dataKey];
        const rightValue = rightRow.querySelector(`[data-sort-${key}]`).dataset[dataKey];
        const leftIsEmpty = leftValue === "";
        const rightIsEmpty = rightValue === "";

        if (leftIsEmpty || rightIsEmpty) {
          if (leftIsEmpty && rightIsEmpty) {
            return Number(leftRow.dataset.originalIndex) - Number(rightRow.dataset.originalIndex);
          }
          return leftIsEmpty ? 1 : -1;
        }

        const result = compareValues(leftValue, rightValue, type);

        if (result !== 0) return result * multiplier;
        return Number(leftRow.dataset.originalIndex) - Number(rightRow.dataset.originalIndex);
      });

      sortButtons.forEach((otherButton) => {
        otherButton.closest("th").setAttribute("aria-sort", "none");
      });
      header.setAttribute("aria-sort", direction);
      rows.forEach((row) => tableBody.appendChild(row));
    });
  });
})();
