(() => {
  const analysisPage = document.getElementById("analysis-page");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const diagnosticSummary = document.getElementById("diagnostic-summary");
  const wordList = document.getElementById("misspelt-word-list");
  const categoryOptions = document.querySelector(".category-options");
  const addWordButton = document.getElementById("add-word-button");
  const markInput = document.getElementById("mark-input");
  const markResult = document.getElementById("mark-result");
  const editAnalysisButton = document.getElementById("edit-analysis-button");
  const approveAnalysisButton = document.getElementById("approve-analysis-button");
  const cancelEditButton = document.getElementById("cancel-edit-button");
  const saveAnalysisButton = document.getElementById("save-analysis-button");
  const documentContent = document.getElementById("document-content");
  const pageData = JSON.parse(document.getElementById("analysis-page-data").textContent);

  const DEFAULT_ERROR_CATEGORIES = [
    "Spelling",
    "Punctuation",
    "Capitalization"
  ];

  let savedState = captureCurrentState();
  renderHighlightedDocument(pageData.submissionText, savedState.words);
  updateMarkResult();

  sidebarToggle.addEventListener("click", () => {
    analysisPage.classList.toggle("sidebar-collapsed");
  });

  editAnalysisButton.addEventListener("click", () => {
    setEditingMode(true);
    diagnosticSummary.focus();
  });

  cancelEditButton.addEventListener("click", () => {
    restoreState(savedState);
    setEditingMode(false);
  });

  saveAnalysisButton.addEventListener("click", async () => {
    const payload = captureCurrentState();

    if (!isValidMark(payload.mark)) {
      alert("Mark must be a number.");
      return;
    }

    try {
      saveAnalysisButton.disabled = true;
      saveAnalysisButton.textContent = "Saving...";

      const response = await fetch(analysisPage.dataset.updateUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosticSummary: payload.summary,
          detectedErrors: payload.words,
          errorCategories: payload.categories,
          mark: payload.mark
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error((result.errors || [result.message || "Unable to save analysis."]).join("\n"));
      }

      const savedCategories =
        Array.isArray(
          result.analysis?.errorCategories
        )
          ? result.analysis.errorCategories
          : payload.categories;


      renderWords(payload.words, savedCategories);

      renderCategoryCheckboxes(savedCategories);

      savedState = captureCurrentState();
      renderHighlightedDocument(pageData.submissionText, savedState.words);
      setEditingMode(false);

      approveAnalysisButton.disabled = false;
      approveAnalysisButton.textContent = "Approve Analysis";
      approveAnalysisButton.classList.remove("approved");
    } catch (error) {
      alert(error.message);
    } finally {
      saveAnalysisButton.disabled = false;
      saveAnalysisButton.textContent = "Save";
    }
  });

  approveAnalysisButton.addEventListener("click", async () => {
    const payload = captureCurrentState();

    if (
      payload.mark === "" ||
      !isValidMark(payload.mark)
    ) {
      alert("Enter a valid mark before approving.");
      return;
    }

    try {
      approveAnalysisButton.disabled = true;
      approveAnalysisButton.textContent = "Approving...";

      const response = await fetch(analysisPage.dataset.approveUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mark: payload.mark
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const message =
          Array.isArray(result.errors)
            ? result.errors.join("\n")
            : result.message ||
              "Unable to save analysis.";

        throw new Error(message);
      }

      approveAnalysisButton.textContent = "Analysis Approved";
      approveAnalysisButton.classList.add("approved");
    } catch (error) {
      approveAnalysisButton.disabled = false;
      approveAnalysisButton.textContent = "Approve Analysis";
      alert(error.message);
    }
  });

  addWordButton.addEventListener("click", () => {
    const newInputs = createWordRow("", "");
    newInputs.wordInput.placeholder = "Enter detected error";
    newInputs.categoryInput.placeholder = "Enter error category";
    newInputs.wordInput.focus();
  });

  wordList.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-word-button");
    if (!removeButton) return;
    removeButton.closest(".word-item")?.remove();
  });

  markInput.addEventListener("input", updateMarkResult);

  function setEditingMode(isEditing) {
    analysisPage.classList.toggle("editing", isEditing);
    diagnosticSummary.readOnly = !isEditing;

    if (!markInput.disabled) {
      markInput.readOnly = !isEditing;
    }

    document.querySelectorAll(".word-input, .error-category-input").forEach((input) => { input.readOnly = !isEditing; });
  }

  function renderCategoryCheckboxes(selectedCategories) {
    const selectedCategoryKeys =
      new Set(
        selectedCategories
          .map(function (category) {
            return String(category || "").trim().toLowerCase();
          })
          .filter(Boolean)
      );


    const availableCategories =
      uniqueCategoriesIgnoreCase([
        ...DEFAULT_ERROR_CATEGORIES,
        ...selectedCategories
      ]);


    categoryOptions.innerHTML = "";


    availableCategories.forEach(
      function (category) {
        const label = document.createElement("label");

        label.className = "category-option";


        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.name = "error-category";
        checkbox.value = category;
        checkbox.disabled = true;
        checkbox.checked = selectedCategoryKeys.has(category.toLowerCase());


        const categoryText = document.createElement("span");

        categoryText.textContent = category;


        label.append(checkbox, categoryText);

        categoryOptions.appendChild(label);
      }
    );
  }


  function uniqueCategoriesIgnoreCase(categories) {
    const seenCategories = new Set();


    return categories.filter(
      function (category) {
        const cleanCategory = String(category || "").trim();

        const categoryKey = cleanCategory.toLowerCase();


        if (
          cleanCategory === "" ||
          seenCategories.has(categoryKey)
        ) {
          return false;
        }


        seenCategories.add(categoryKey);

        return true;
      }
    );
  }


  function renderWords(words, categories) {
    wordList.innerHTML = "";
    words.forEach((word, index) => {
      createWordRow(word, categories[index] || "");
    });
  }

  function createWordRow(word, category) {
    const listItem = document.createElement("li");
    listItem.className = "word-item";

    const bullet = document.createElement("span");
    bullet.className = "word-bullet";
    bullet.textContent = "•";

    const wordInput = document.createElement("input");
    wordInput.type = "text";
    wordInput.className = "word-input";
    wordInput.value = word;
    wordInput.readOnly = !analysisPage.classList.contains("editing");

    const categoryInput = document.createElement("input");
    categoryInput.type = "text";
    categoryInput.className = "error-category-input";
    categoryInput.value = category;
    categoryInput.readOnly = !analysisPage.classList.contains("editing");

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-word-button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remove ${word || "error"}`);

    listItem.append(bullet, wordInput, categoryInput, removeButton);
    wordList.appendChild(listItem);
    return {
      wordInput,
      categoryInput
    };
  }

  function captureCurrentState() {
    const errorPairs = Array.from(document.querySelectorAll(".word-item"))
      .map((wordItem) => ({
        word: wordItem.querySelector(".word-input").value.trim(),
        category: wordItem.querySelector(".error-category-input").value.trim()
      }))
      .filter((errorPair) => errorPair.word !== "" || errorPair.category !== "");

    return {
      summary: diagnosticSummary.value,
      categories: errorPairs.map((errorPair) => errorPair.category),
      words: errorPairs.map((errorPair) => errorPair.word),
      mark: markInput.value.trim()
    };
  }

  function restoreState(state) {
    diagnosticSummary.value = state.summary;
    renderWords(state.words, state.categories);
    markInput.value = state.mark;
    updateMarkResult();
    renderHighlightedDocument(pageData.submissionText, state.words);
  }

  function isValidMark(mark) {
    const cleanMark = String(mark).trim();


    if (cleanMark === "") {
      return true;
    }


    return (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleanMark) && Number.isFinite(Number(cleanMark)));
  }

  function updateMarkResult() {
    const cleanMark = markInput.value.trim();

    const hasPassingMark =
      pageData.passingMark !== null &&
      pageData.passingMark !== undefined &&
      String(
        pageData.passingMark
      ).trim() !== "";

    const passingMark = hasPassingMark ? Number(pageData.passingMark) : Number.NaN;


    markResult.classList.remove("pass", "fail", "not-available");


    if (
      cleanMark === "" ||
      !isValidMark(cleanMark) ||
      !Number.isFinite(passingMark)
    ) {
      markResult.textContent = "NOT AVAILABLE";

      markResult.classList.add("not-available");

      return;
    }


    if (Number(cleanMark) >= passingMark) {
      markResult.textContent = "PASS";
      markResult.classList.add("pass");
    } else {
      markResult.textContent = "FAIL";
      markResult.classList.add("fail");
    }
  }

  function renderHighlightedDocument(text, errors) {
    documentContent.replaceChildren();
    const cleanErrors = [...new Set(errors.map((error) => error.trim()).filter(Boolean))]
      .sort((a, b) => b.length - a.length);

    if (cleanErrors.length === 0) {
      documentContent.textContent = text;
      return;
    }

    const errorSet = new Set(cleanErrors.map((error) => error.toLowerCase()));
    const pattern = new RegExp(`(${cleanErrors.map(escapeRegExp).join("|")})`, "gi");

    text.split(pattern).forEach((part) => {
      if (errorSet.has(part.toLowerCase())) {
        const highlight = document.createElement("span");
        highlight.className = "error-highlight";
        highlight.textContent = part;
        documentContent.appendChild(highlight);
      } else {
        documentContent.appendChild(document.createTextNode(part));
      }
    });
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
})();