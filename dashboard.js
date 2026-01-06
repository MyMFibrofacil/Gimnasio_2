(function () {
    var STORAGE_KEY = "workoutWorkbook";
    var SELECTED_DAY_KEY = "workoutSelectedDay";
    var TIMER_ONLY_KEY = "timerOnlyMode";

    function arrayBufferToBase64(buffer) {
      var bytes = new Uint8Array(buffer || []);
      var chunkSize = 0x8000;
      var binary = "";
      for (var i = 0; i < bytes.length; i += chunkSize) {
        var chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
      }
      return btoa(binary);
    }

    function base64ToArrayBuffer(base64) {
      var binary = atob(base64);
      var length = binary.length;
      var bytes = new Uint8Array(length);
      for (var i = 0; i < length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }

    function storeWorkbookBuffer(buffer) {
      if (!buffer || !window.sessionStorage) {
        return false;
      }
      try {
        var base64 = arrayBufferToBase64(buffer);
        sessionStorage.setItem(STORAGE_KEY, base64);
        return true;
      } catch (error) {
        return false;
      }
    }

    function loadWorkbookFromStorage() {
      if (!window.sessionStorage) {
        return null;
      }
      var base64 = sessionStorage.getItem(STORAGE_KEY);
      if (!base64 || !window.XLSX) {
        return null;
      }
      try {
        var buffer = base64ToArrayBuffer(base64);
        return XLSX.read(buffer, { type: "array" });
      } catch (error) {
        return null;
      }
    }

    function initWorkoutFileLoader() {
      var overlay = document.getElementById("file-loader-overlay");
      var fileInput = document.getElementById("workout-file-input");
      var fileButton = document.getElementById("workout-file-button");
      var fileButtonLabel = document.getElementById("workout-file-button-label");
      var daySelect = document.getElementById("workout-day-select");
      var daySelectMain = document.getElementById("workout-day-select-main");
      var errorText = document.getElementById("workout-file-error");
      var exerciseList = document.getElementById("exercise-list");
      var categoryTemplate = document.getElementById("exercise-category-template");
      var exerciseTemplate = document.getElementById("exercise-template");
      var openLoaderButton = document.getElementById("open-file-loader-button");
      var timerStartButton = document.getElementById("timer-start-button");
      var timerSection = document.getElementById("timer-section");
      var timerCloseButton = document.getElementById("timer-close-button");
      var emptyState = document.getElementById("workout-empty-state");
      var bodyElement = document.body;
      var defaultFileButtonText = "Cargar Archivo Excel";
      var loadedFileButtonText = "Rutina Cargada";

      if (!daySelectMain || !exerciseList || !categoryTemplate || !exerciseTemplate) {
        return;
      }

      var currentWorkbook = null;
      var historyData = null;
      var repsColumns = [3, 4, 5, 6, 7, 8];

      function setOverlayVisible(isVisible) {
        if (!overlay) {
          return;
        }
        overlay.style.display = isVisible ? "block" : "none";
      }

      function setTimerOnlyMode(isEnabled) {
        if (bodyElement) {
          bodyElement.classList.toggle("timer-only-mode", isEnabled);
        }
        if (timerSection && isEnabled) {
          timerSection.setAttribute("open", "");
        }
        if (isEnabled) {
          setOverlayVisible(true);
        }
      }

      function showError(message) {
        if (!errorText) {
          return;
        }
        errorText.textContent = message || "";
        errorText.hidden = !message;
      }

      function setFileButtonText(text) {
        if (fileButtonLabel) {
          fileButtonLabel.textContent = text;
        }
      }

      function showThinkingState() {
        if (!exerciseList) {
          return;
        }
        exerciseList.innerHTML = "<div class=\"text-sm font-semibold text-gray-600 dark:text-text-secondary\">Pensando...</div>";
      }

      function resetDaySelect(select) {
        if (!select) {
          return;
        }
        select.innerHTML = "";
        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Selecciona un dia";
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);
        select.disabled = true;
      }

      function resetDaySelects() {
        resetDaySelect(daySelect);
        resetDaySelect(daySelectMain);
      }

      function populateDaySelects(sheetNames) {
        resetDaySelects();
        sheetNames.forEach(function (sheetName) {
          if (daySelect) {
            var option = document.createElement("option");
            option.value = sheetName;
            option.textContent = sheetName;
            daySelect.appendChild(option);
          }

          if (daySelectMain) {
            var optionMain = document.createElement("option");
            optionMain.value = sheetName;
            optionMain.textContent = sheetName;
            daySelectMain.appendChild(optionMain);
          }
        });
        var shouldDisable = sheetNames.length === 0;
        if (daySelect) {
          daySelect.disabled = shouldDisable;
        }
        if (daySelectMain) {
          daySelectMain.disabled = shouldDisable;
        }
      }

      function setEmptyStateVisible(isVisible) {
        if (!emptyState) {
          return;
        }
        emptyState.hidden = !isVisible;
      }

      function buildRepItem(value) {
        var wrapper = document.createElement("div");
        wrapper.className = "flex flex-col items-center min-w-[2.25rem] gap-1";
        var text = document.createElement("span");
        text.className = "text-sm font-medium text-gray-900 dark:text-white";
        text.textContent = value;
        wrapper.appendChild(text);
        return wrapper;
      }

      function buildWeightInput(value) {
        var input = document.createElement("input");
        input.className = "w-10 h-8 p-1 text-center bg-white dark:bg-background-dark border border-gray-300 dark:border-border-dark rounded focus:border-primary focus:ring-1 focus:ring-primary text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400";
        input.placeholder = "kg";
        input.type = "text";
        input.value = value;
        return input;
      }

      function setupBarControls(card) {
        var barToggle = card.querySelector("[data-bar-toggle]");
        var barWeight = card.querySelector("[data-bar-weight]");
        var barWeightWrapper = card.querySelector("[data-bar-weight-wrapper]");
        if (!barToggle || !barWeight) {
          return;
        }

        function updateBarState() {
          var isEnabled = barToggle.checked;
          barWeight.disabled = !isEnabled;
          if (barWeightWrapper) {
            barWeightWrapper.style.display = isEnabled ? "flex" : "none";
          }
          if (!isEnabled) {
            barWeight.value = "";
          }
        }

        barToggle.addEventListener("change", updateBarState);
        updateBarState();
      }

      function renderExercises(categories) {
        exerciseList.innerHTML = "";

        categories.forEach(function (category) {
          var categoryCard = categoryTemplate.content.firstElementChild.cloneNode(true);
          var categoryName = category && category.categoria ? category.categoria : "General";
          var categoryBody = categoryCard.querySelector("[data-category-body]");

          categoryCard.querySelector("[data-category-name]").textContent = categoryName;

          var exercises = Array.isArray(category && category.ejercicios) ? category.ejercicios : [];
          exercises.forEach(function (exercise) {
            var card = exerciseTemplate.content.firstElementChild.cloneNode(true);
            var name = exercise && exercise.nombre ? exercise.nombre : "Ejercicio";
            var series = Array.isArray(exercise && exercise.series) ? exercise.series : [];

            card.querySelector("[data-exercise-name]").textContent = name;
            card.querySelector("[data-series-count]").textContent = String(series.length) + " Series";

            var repsRow = card.querySelector("[data-reps-row]");
            var weightsRow = card.querySelector("[data-weights-row]");

            series.forEach(function (serie) {
              var repsValue = serie && serie.reps != null ? String(serie.reps) : "";
              var weightValue = serie && serie.peso != null ? String(serie.peso) : "";
              repsRow.appendChild(buildRepItem(repsValue));
              weightsRow.appendChild(buildWeightInput(weightValue));
            });

            var barToggle = card.querySelector("[data-bar-toggle]");
            var barWeightInput = card.querySelector("[data-bar-weight]");
            if (exercise && exercise.pesoBarra) {
              if (barToggle) {
                barToggle.checked = true;
              }
              if (barWeightInput) {
                barWeightInput.value = String(exercise.pesoBarra);
              }
            }

            setupBarControls(card);
            categoryBody.appendChild(card);
          });

          exerciseList.appendChild(categoryCard);
        });
      }

      function normalizeHeader(value) {
        return String(value || "")
          .toLowerCase()
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "");
      }

      function normalizeExerciseName(value) {
        return String(value || "").trim().toLowerCase();
      }

      function parseDateValue(value) {
        if (!value) {
          return null;
        }
        if (value instanceof Date) {
          return value;
        }
        if (typeof value === "number" && window.XLSX && XLSX.SSF && XLSX.SSF.parse_date_code) {
          var parsed = XLSX.SSF.parse_date_code(value);
          if (parsed && parsed.y && parsed.m && parsed.d) {
            return new Date(parsed.y, parsed.m - 1, parsed.d);
          }
        }
        var text = String(value).trim();
        var match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (match) {
          var day = parseInt(match[1], 10);
          var month = parseInt(match[2], 10);
          var year = parseInt(match[3], 10);
          if (year < 100) {
            year += 2000;
          }
          return new Date(year, month - 1, day);
        }
        return null;
      }

      function parseHistoryFromWorkbook() {
        if (!currentWorkbook || !currentWorkbook.Sheets || !currentWorkbook.Sheets.Datos) {
          return { seriesMap: new Map(), barMap: new Map() };
        }

        var sheet = currentWorkbook.Sheets.Datos;
        var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (!rows.length) {
          return { seriesMap: new Map(), barMap: new Map() };
        }

        var seriesMap = new Map();
        var barMap = new Map();

        rows.forEach(function (row, index) {
          if (index === 0 && normalizeHeader(row[0]) === "fecha") {
            return;
          }

          var dateValue = parseDateValue(row[0]);
          var exerciseName = String(row[5] || "").trim();
          var seriesRaw = row[6];
          var seriesIndex = parseInt(seriesRaw, 10);
          var pesoValue = String(row[8] || "").trim();
          var barValue = String(row[9] || "").trim();

          if (!exerciseName || !dateValue || Number.isNaN(seriesIndex) || seriesIndex <= 0) {
            return;
          }

          var timestamp = dateValue.getTime();
          var normalizedName = normalizeExerciseName(exerciseName);
          var seriesKey = normalizedName + "|" + seriesIndex;

          if (pesoValue) {
            var existing = seriesMap.get(seriesKey);
            if (!existing || timestamp > existing.timestamp) {
              seriesMap.set(seriesKey, { peso: pesoValue, timestamp: timestamp });
            }
          }

          var barNumber = parseFloat(String(barValue).replace(",", "."));
          var hasBarValue = barValue && !(barNumber === 0 || Number.isNaN(barNumber));
          if (hasBarValue) {
            var existingBar = barMap.get(normalizedName);
            if (!existingBar || timestamp > existingBar.timestamp) {
              barMap.set(normalizedName, { pesoBarra: barValue, timestamp: timestamp });
            }
          }
        });

        return { seriesMap: seriesMap, barMap: barMap };
      }

      function isHeaderRow(row) {
        var categoryValue = normalizeHeader(row[0]);
        var exerciseValue = normalizeHeader(row[1]);
        var seriesValue = normalizeHeader(row[2]);
        return (
          categoryValue === "categoria" ||
          categoryValue === "grupo" ||
          categoryValue === "grupodetrabajo" ||
          categoryValue === "musculo" ||
          categoryValue === "musculos" ||
          exerciseValue === "ejercicio" ||
          exerciseValue === "exercise" ||
          seriesValue === "series" ||
          seriesValue === "serie"
        );
      }

      function parseExercisesFromWorkbook(sheetName) {
        if (!window.XLSX) {
          showError("No se cargo la libreria para leer archivos .xlsx.");
          return null;
        }

        if (!currentWorkbook) {
          showError("Primero selecciona un archivo.");
          return null;
        }

        if (!sheetName) {
          showError("Selecciona un dia de entrenamiento.");
          return null;
        }

        var sheet = currentWorkbook.Sheets[sheetName];
        if (!sheet) {
          showError("No se encontro la hoja seleccionada.");
          return null;
        }

        var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (!rows.length) {
          showError("La hoja esta vacia.");
          return null;
        }

        var categoriesMap = new Map();
        var hasData = false;

        rows.forEach(function (row, index) {
          if (index === 0 && isHeaderRow(row)) {
            return;
          }

          var categoryName = String(row[0] || "").trim();
          var name = String(row[1] || "").trim();
          var seriesCountRaw = row[2];
          var seriesCount = parseInt(seriesCountRaw, 10);
          if (Number.isNaN(seriesCount) || seriesCount < 0) {
            seriesCount = 0;
          }

          var repsValues = repsColumns.map(function (columnIndex) {
            return row[columnIndex];
          });

          var hasRepsData = repsValues.some(function (value) {
            return String(value || "").trim() !== "";
          });

          if (!name && seriesCount === 0 && !hasRepsData) {
            return;
          }

          if (!categoryName) {
            categoryName = "General";
          }

          if (!name) {
            name = "Ejercicio";
          }

          if (seriesCount === 0 && hasRepsData) {
            seriesCount = repsValues.filter(function (value) {
              return String(value || "").trim() !== "";
            }).length;
          }

          seriesCount = Math.min(seriesCount, repsColumns.length);

          var series = [];
          repsValues.slice(0, seriesCount).forEach(function (value) {
            series.push({
              reps: String(value || "").trim(),
              peso: ""
            });
          });

          if (series.length === 0) {
            return;
          }

          if (!categoriesMap.has(categoryName)) {
            categoriesMap.set(categoryName, []);
          }
          categoriesMap.get(categoryName).push({ nombre: name, series: series });
          hasData = true;
        });

        if (!hasData) {
          showError("No se encontraron ejercicios en la hoja.");
          return null;
        }

        return Array.from(categoriesMap, function (entry) {
          return { categoria: entry[0], ejercicios: entry[1] };
        });
      }

      function applyHistoryToExercises(categories) {
        if (!historyData) {
          return categories;
        }

        categories.forEach(function (category) {
          var exercises = Array.isArray(category.ejercicios) ? category.ejercicios : [];
          exercises.forEach(function (exercise) {
            var normalizedName = normalizeExerciseName(exercise.nombre);
            var barEntry = historyData.barMap.get(normalizedName);
            if (barEntry && barEntry.pesoBarra) {
              exercise.pesoBarra = barEntry.pesoBarra;
            }

            var series = Array.isArray(exercise.series) ? exercise.series : [];
            series.forEach(function (serie, index) {
              var seriesKey = normalizedName + "|" + (index + 1);
              var seriesEntry = historyData.seriesMap.get(seriesKey);
              if (seriesEntry && seriesEntry.peso) {
                serie.peso = seriesEntry.peso;
              }
            });
          });
        });

        return categories;
      }

      function syncDaySelects(selectedSheet) {
        if (daySelect && daySelect.value !== selectedSheet) {
          daySelect.value = selectedSheet;
        }
        if (daySelectMain && daySelectMain.value !== selectedSheet) {
          daySelectMain.value = selectedSheet;
        }
      }

      function handleDaySelection(selectedSheet) {
        if (!selectedSheet) {
          return;
        }

        showError("");
        showThinkingState();

        window.setTimeout(function () {
          var exercises = parseExercisesFromWorkbook(selectedSheet);
          if (!exercises) {
            if (exerciseList) {
              exerciseList.innerHTML = "";
            }
            return;
          }

          exercises = applyHistoryToExercises(exercises);
          renderExercises(exercises);
          showError("");
          setTimerOnlyMode(false);
          setOverlayVisible(false);
          syncDaySelects(selectedSheet);
          setEmptyStateVisible(false);
          if (window.sessionStorage) {
            sessionStorage.setItem(SELECTED_DAY_KEY, selectedSheet);
          }
        }, 0);
      }

      if (daySelect) {
        daySelect.addEventListener("change", function () {
          handleDaySelection(daySelect.value);
        });
      }

      if (daySelectMain) {
        daySelectMain.addEventListener("change", function () {
          handleDaySelection(daySelectMain.value);
        });
      }

      function hydrateWorkbook(workbook) {
        if (!workbook) {
          return [];
        }
        currentWorkbook = workbook;
        historyData = parseHistoryFromWorkbook();
        var sheetNames = currentWorkbook.SheetNames || [];
        if (!sheetNames.length) {
          showError("El archivo no contiene hojas.");
          return [];
        }

        var daySheetNames = sheetNames.filter(function (name) {
          return normalizeHeader(name) !== "datos";
        });

        populateDaySelects(daySheetNames);
        if (daySheetNames.length) {
          setFileButtonText(loadedFileButtonText);
        }
        return daySheetNames;
      }

      if (fileInput) {
        fileInput.addEventListener("change", function (event) {
          var file = event.target.files && event.target.files[0];
          if (!file) {
            return;
          }

          showError("");
          setFileButtonText(defaultFileButtonText);
          resetDaySelects();
          currentWorkbook = null;
          historyData = null;
          setOverlayVisible(true);
          setEmptyStateVisible(false);
          if (window.sessionStorage) {
            sessionStorage.removeItem(SELECTED_DAY_KEY);
          }

          if (!/\.xlsx$/i.test(file.name)) {
            showError("El archivo debe ser .xlsx.");
            return;
          }

          var reader = new FileReader();
          reader.onload = function () {
            try {
              var workbook = XLSX.read(reader.result, { type: "array" });
              var daySheetNames = hydrateWorkbook(workbook);
              storeWorkbookBuffer(reader.result);
              if (daySheetNames.length === 1) {
                handleDaySelection(daySheetNames[0]);
              }
            } catch (error) {
              showError("No se pudo leer el archivo. Verifica que sea .xlsx valido.");
            }
          };
          reader.readAsArrayBuffer(file);
        });
      }

      if (fileButton && fileInput) {
        fileButton.addEventListener("click", function () {
          showError("");
          fileInput.click();
        });
      }

      if (timerStartButton) {
        timerStartButton.addEventListener("click", function () {
          showError("");
          setTimerOnlyMode(true);
          if (timerSection && timerSection.scrollIntoView) {
            timerSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }

      if (openLoaderButton) {
        openLoaderButton.addEventListener("click", function () {
          if (!overlay) {
            window.location.href = "index.html";
            return;
          }
          showError("");
          setTimerOnlyMode(false);
          setOverlayVisible(true);
        });
      }

      if (timerCloseButton) {
        timerCloseButton.addEventListener("click", function () {
          setTimerOnlyMode(false);
        });
      }

      resetDaySelects();
      var storedWorkbook = loadWorkbookFromStorage();
      if (storedWorkbook) {
        var storedDays = hydrateWorkbook(storedWorkbook);
        var storedSelectedDay = window.sessionStorage ? sessionStorage.getItem(SELECTED_DAY_KEY) : "";
        if (storedSelectedDay && storedDays.indexOf(storedSelectedDay) !== -1) {
          handleDaySelection(storedSelectedDay);
        } else if (storedDays.length === 1) {
          handleDaySelection(storedDays[0]);
        } else {
          setEmptyStateVisible(false);
        }
      } else {
        setEmptyStateVisible(true);
      }

      if (window.sessionStorage && sessionStorage.getItem(TIMER_ONLY_KEY)) {
        sessionStorage.removeItem(TIMER_ONLY_KEY);
        setTimerOnlyMode(true);
        if (timerSection && timerSection.scrollIntoView) {
          timerSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }

    function initCyclePhaseToggle() {
      var genderToggle = document.getElementById("gender-toggle");
      var cyclePhaseSection = document.getElementById("cycle-phase-section");

      if (!genderToggle || !cyclePhaseSection) {
        return;
      }

      function updateCyclePhaseVisibility() {
        cyclePhaseSection.hidden = !genderToggle.checked;
      }

      genderToggle.addEventListener("change", updateCyclePhaseVisibility);
      updateCyclePhaseVisibility();
    }

    function initTimerSection() {
      var timerSection = document.getElementById("timer-section");
      var timerToggleButton = document.getElementById("timer-toggle-button");
      var timerCloseButton = document.getElementById("timer-close-button");

      if (!timerSection || !timerToggleButton || !timerCloseButton) {
        return;
      }

      timerToggleButton.addEventListener("click", function () {
        timerSection.toggleAttribute("open");
      });

      timerCloseButton.addEventListener("click", function () {
        timerSection.removeAttribute("open");
      });
    }

    function initWorkoutTimer() {
      var seriesInput = document.getElementById("timer-series-input");
      var repsInput = document.getElementById("timer-reps-input");
      var prepInput = document.getElementById("timer-prep-input");
      var restInput = document.getElementById("timer-rest-input");
      var workInput = document.getElementById("timer-work-input");
      var phaseLabel = document.getElementById("timer-phase-label");
      var timeLabel = document.getElementById("timer-remaining-time");
      var nextLabel = document.getElementById("timer-next-label");
      var timerRing = document.getElementById("timer-ring");
      var pauseButton = document.getElementById("timer-pause-button");
      var playButton = document.getElementById("timer-play-button");
      var stopButton = document.getElementById("timer-stop-button");

      if (!seriesInput || !repsInput || !prepInput || !restInput || !workInput || !phaseLabel || !timeLabel || !nextLabel || !timerRing || !pauseButton || !playButton || !stopButton) {
        return;
      }

      var intervalId = null;
      var timerState = null;
      var timerStatus = "idle";

      function setButtonVisibility(status) {
        timerStatus = status;
        if (status === "running") {
          playButton.style.display = "none";
          pauseButton.style.display = "";
          stopButton.style.display = "";
          return;
        }
        if (status === "paused") {
          playButton.style.display = "";
          pauseButton.style.display = "none";
          stopButton.style.display = "";
          return;
        }
        playButton.style.display = "";
        pauseButton.style.display = "none";
        stopButton.style.display = "none";
      }

      function clampNumber(value, fallback) {
        var parsed = parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed < 0) {
          return fallback;
        }
        return parsed;
      }

      function getSettings() {
        var totalSeries = clampNumber(seriesInput.value, 1);
        if (totalSeries === 0) {
          totalSeries = 1;
        }
        var repsPerSeries = clampNumber(repsInput.value, 1);
        if (repsPerSeries === 0) {
          repsPerSeries = 1;
        }
        return {
          totalSeries: totalSeries,
          repsPerSeries: repsPerSeries,
          prepSeconds: clampNumber(prepInput.value, 0),
          restSeconds: clampNumber(restInput.value, 0),
          workSeconds: clampNumber(workInput.value, 0)
        };
      }

      function formatTime(seconds) {
        var safeSeconds = Math.max(0, seconds || 0);
        var minutes = Math.floor(safeSeconds / 60);
        var remaining = safeSeconds % 60;
        return String(minutes).padStart(2, "0") + ":" + String(remaining).padStart(2, "0");
      }

      function getProgressLabel(state) {
        if (!state) {
          return "Repeticion 0/0 · Serie 0/0";
        }
        return (
          "Repeticion " +
          state.repIndex +
          "/" +
          state.repsPerSeries +
          " · Serie " +
          state.seriesIndex +
          "/" +
          state.totalSeries
        );
      }

      function getNextLabel(state) {
        if (!state) {
          return "Repeticion 0/0 · Serie 0/0";
        }
        if (state.phase === "Descanso") {
          var nextSeries = state.seriesIndex;
          var nextRep = state.repIndex;
          if (state.repIndex < state.repsPerSeries) {
            nextRep = state.repIndex + 1;
          } else if (state.seriesIndex < state.totalSeries) {
            nextSeries = state.seriesIndex + 1;
            nextRep = 1;
          }
          return (
            "Siguiente: Repeticion " +
            nextRep +
            "/" +
            state.repsPerSeries +
            " · Serie " +
            nextSeries +
            "/" +
            state.totalSeries
          );
        }
        return getProgressLabel(state);
      }

      function updateDisplay(state) {
        if (!state) {
          return;
        }
        phaseLabel.textContent = state.phase;
        timeLabel.textContent = formatTime(state.remainingSeconds);
        nextLabel.textContent = getNextLabel(state);
        timerRing.classList.remove("bg-green-500", "bg-yellow-500", "bg-red-500");
        if (state.phase === "Trabajo") {
          timerRing.classList.add("bg-green-500");
        } else if (state.phase === "Preparacion") {
          timerRing.classList.add("bg-yellow-500");
        } else {
          timerRing.classList.add("bg-red-500");
        }
      }

      function setDisplayToSettings() {
        var settings = getSettings();
        var initialPhase = settings.prepSeconds > 0 ? "Preparacion" : "Trabajo";
        var initialSeconds = settings.prepSeconds > 0 ? settings.prepSeconds : settings.workSeconds;
        if (initialSeconds <= 0) {
          initialPhase = "Descanso";
          initialSeconds = settings.restSeconds;
        }
        var previewState = {
          phase: initialPhase,
          remainingSeconds: initialSeconds,
          seriesIndex: 1,
          totalSeries: settings.totalSeries,
          repIndex: 1,
          repsPerSeries: settings.repsPerSeries
        };
        updateDisplay(previewState);
      }

      function clearTimerInterval() {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }

      function stopTimer(resetDisplay) {
        clearTimerInterval();
        timerState = null;
        if (resetDisplay) {
          setDisplayToSettings();
        }
        setButtonVisibility("idle");
      }

      function finishTimer() {
        clearTimerInterval();
        if (timerState) {
          phaseLabel.textContent = "Completado";
          timeLabel.textContent = "00:00";
          nextLabel.textContent = getProgressLabel({
            seriesIndex: timerState.totalSeries,
            totalSeries: timerState.totalSeries,
            repIndex: timerState.repsPerSeries,
            repsPerSeries: timerState.repsPerSeries
          });
        }
        timerState = null;
        setButtonVisibility("idle");
      }

      function advancePhase(state) {
        var settings = state.settings;
        if (settings.prepSeconds <= 0 && settings.workSeconds <= 0 && settings.restSeconds <= 0) {
          finishTimer();
          return;
        }
        if (state.phase === "Preparacion") {
          state.phase = "Trabajo";
          state.remainingSeconds = settings.workSeconds;
          if (state.remainingSeconds <= 0) {
            advancePhase(state);
          }
          return;
        }

        if (state.phase === "Trabajo") {
          if (state.repIndex < settings.repsPerSeries) {
            if (settings.restSeconds > 0) {
              state.phase = "Descanso";
              state.remainingSeconds = settings.restSeconds;
              return;
            }
            state.repIndex += 1;
            state.phase = "Trabajo";
            state.remainingSeconds = settings.workSeconds;
            if (state.remainingSeconds <= 0) {
              advancePhase(state);
            }
            return;
          }
          if (state.seriesIndex < settings.totalSeries) {
            state.seriesIndex += 1;
            state.repIndex = 1;
            state.phase = settings.prepSeconds > 0 ? "Preparacion" : "Trabajo";
            state.remainingSeconds = settings.prepSeconds > 0 ? settings.prepSeconds : settings.workSeconds;
            if (state.remainingSeconds <= 0) {
              advancePhase(state);
            }
            return;
          }
          finishTimer();
          return;
        }

        if (state.phase === "Descanso") {
          if (state.repIndex < settings.repsPerSeries) {
            state.repIndex += 1;
            state.phase = "Trabajo";
            state.remainingSeconds = settings.workSeconds;
            if (state.remainingSeconds <= 0) {
              advancePhase(state);
            }
            return;
          }
          if (state.seriesIndex < settings.totalSeries) {
            state.seriesIndex += 1;
            state.repIndex = 1;
            state.phase = settings.prepSeconds > 0 ? "Preparacion" : "Trabajo";
            state.remainingSeconds = settings.prepSeconds > 0 ? settings.prepSeconds : settings.workSeconds;
            if (state.remainingSeconds <= 0) {
              advancePhase(state);
            }
            return;
          }
          finishTimer();
        }
      }

      function tick() {
        if (!timerState) {
          return;
        }

        if (timerState.remainingSeconds > 0) {
          timerState.remainingSeconds -= 1;
          updateDisplay(timerState);
          return;
        }

        advancePhase(timerState);
        if (timerState) {
          updateDisplay(timerState);
          if (timerState.remainingSeconds === 0) {
            tick();
          }
        }
      }

      function startTimer() {
        var settings = getSettings();
        var initialPhase = settings.prepSeconds > 0 ? "Preparacion" : "Trabajo";
        var initialSeconds = settings.prepSeconds > 0 ? settings.prepSeconds : settings.workSeconds;
        if (initialSeconds <= 0) {
          initialPhase = "Descanso";
          initialSeconds = settings.restSeconds;
        }

        if (settings.prepSeconds <= 0 && settings.workSeconds <= 0 && settings.restSeconds <= 0) {
          finishTimer();
          return;
        }

        timerState = {
          phase: initialPhase,
          remainingSeconds: initialSeconds,
          seriesIndex: 1,
          totalSeries: settings.totalSeries,
          repIndex: 1,
          repsPerSeries: settings.repsPerSeries,
          settings: settings
        };

        updateDisplay(timerState);
        clearTimerInterval();
        intervalId = setInterval(tick, 1000);
        setButtonVisibility("running");
      }

      pauseButton.addEventListener("click", function () {
        clearTimerInterval();
        setButtonVisibility("paused");
      });

      playButton.addEventListener("click", function () {
        if (intervalId) {
          return;
        }
        if (timerState) {
          intervalId = setInterval(tick, 1000);
          setButtonVisibility("running");
          return;
        }
        startTimer();
      });

      stopButton.addEventListener("click", function () {
        stopTimer(true);
      });

      setDisplayToSettings();
      setButtonVisibility("idle");
    }

    function formatCurrentTime() {
      var now = new Date();
      var hours = String(now.getHours()).padStart(2, "0");
      var minutes = String(now.getMinutes()).padStart(2, "0");
      var seconds = String(now.getSeconds()).padStart(2, "0");
      return hours + ":" + minutes + ":" + seconds;
    }

    function initTimeButtons() {
      var startTimeInput = document.getElementById("start-time-input");
      var endTimeInput = document.getElementById("end-time-input");
      var startTimeButton = document.getElementById("start-time-button");
      var endTimeButton = document.getElementById("end-time-button");

      if (!startTimeInput || !endTimeInput || !startTimeButton || !endTimeButton) {
        return;
      }

      startTimeButton.addEventListener("click", function () {
        startTimeInput.value = formatCurrentTime();
      });

      endTimeButton.addEventListener("click", function () {
        endTimeInput.value = formatCurrentTime();
      });
    }

    function initExportButton() {
      var endTimeButton = document.getElementById("end-time-button");
      var exportButton = document.getElementById("export-data-button");
      var genderToggle = document.getElementById("gender-toggle");
      var startTimeInput = document.getElementById("start-time-input");
      var endTimeInput = document.getElementById("end-time-input");

      if (!endTimeButton || !exportButton) {
        return;
      }

      function getTodayString() {
        var now = new Date();
        var day = String(now.getDate()).padStart(2, "0");
        var month = String(now.getMonth() + 1).padStart(2, "0");
        var year = String(now.getFullYear());
        return day + "-" + month + "-" + year;
      }

      function getCyclePhaseValue() {
        if (!genderToggle || !genderToggle.checked) {
          return "";
        }
        var cycleSelect = document.querySelector("#cycle-phase-section select");
        if (!cycleSelect) {
          return "";
        }
        return cycleSelect.value || "";
      }

      function getStoredWeatherSummary() {
        if (!window.sessionStorage) {
          return "";
        }
        var raw = sessionStorage.getItem("workoutWeatherSnapshot");
        if (!raw) {
          return "";
        }
        try {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.summary) {
            return parsed.summary;
          }
        } catch (error) {
          return "";
        }
        return "";
      }

      function parseTimeToSeconds(timeValue) {
        if (!timeValue) {
          return null;
        }
        var parts = String(timeValue).split(":");
        if (parts.length < 2) {
          return null;
        }
        var hours = parseInt(parts[0], 10);
        var minutes = parseInt(parts[1], 10);
        var seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;
        if ([hours, minutes, seconds].some(function (value) { return Number.isNaN(value); })) {
          return null;
        }
        return (hours * 3600) + (minutes * 60) + seconds;
      }

      function formatDuration(seconds) {
        var safeSeconds = Math.max(0, seconds || 0);
        var hours = Math.floor(safeSeconds / 3600);
        var minutes = Math.floor((safeSeconds % 3600) / 60);
        var remaining = safeSeconds % 60;
        return (
          String(hours).padStart(2, "0") +
          ":" +
          String(minutes).padStart(2, "0") +
          ":" +
          String(remaining).padStart(2, "0")
        );
      }

      function getDurationValue(startValue, endValue) {
        var startSeconds = parseTimeToSeconds(startValue);
        var endSeconds = parseTimeToSeconds(endValue);
        if (startSeconds === null || endSeconds === null) {
          return "";
        }
        var diff = endSeconds - startSeconds;
        if (diff < 0) {
          diff += 24 * 3600;
        }
        return formatDuration(diff);
      }

      function findExerciseCard(element) {
        var current = element;
        while (current && current !== document.body) {
          if (current.querySelector && current.querySelector("[data-reps-row]") && current.querySelector("[data-weights-row]")) {
            return current;
          }
          current = current.parentElement;
        }
        return null;
      }

      function collectExerciseRows() {
        var exerciseList = document.getElementById("exercise-list");
        if (!exerciseList) {
          return [];
        }

        var rows = [];
        var nameElements = exerciseList.querySelectorAll("[data-exercise-name]");

        nameElements.forEach(function (nameElement) {
          var card = findExerciseCard(nameElement);
          if (!card) {
            return;
          }

          var repsRow = card.querySelector("[data-reps-row]");
          var weightsRow = card.querySelector("[data-weights-row]");
          if (!repsRow || !weightsRow) {
            return;
          }

          var barToggle = card.querySelector("[data-bar-toggle]");
          var barWeightInput = card.querySelector("[data-bar-weight]");
          var barWeightValue = "0";
          if (barToggle && barToggle.checked) {
            barWeightValue = barWeightInput ? barWeightInput.value.trim() : "";
            if (!barWeightValue) {
              barWeightValue = "0";
            }
          }

          var repsItems = Array.prototype.slice.call(repsRow.querySelectorAll("span"));
          var weightInputs = Array.prototype.slice.call(weightsRow.querySelectorAll("input"));
          var seriesCount = Math.max(repsItems.length, weightInputs.length);

          for (var i = 0; i < seriesCount; i += 1) {
            var repsValue = repsItems[i] ? repsItems[i].textContent.trim() : "";
            var weightValue = weightInputs[i] ? weightInputs[i].value.trim() : "";
            rows.push({
              ejercicio: nameElement.textContent.trim() || "Ejercicio",
              serie: i + 1,
              repeticiones: repsValue,
              peso: weightValue,
              pesoBarra: barWeightValue
            });
          }
        });

        return rows;
      }

      endTimeButton.addEventListener("click", function () {
        exportButton.style.display = "block";
      });

      exportButton.addEventListener("click", function () {
        if (!window.XLSX) {
          return;
        }
        var dateValue = getTodayString();
        var cyclePhase = getCyclePhaseValue();
        var startTimeValue = startTimeInput ? startTimeInput.value : "";
        var endTimeValue = endTimeInput ? endTimeInput.value : "";
        var durationValue = getDurationValue(startTimeValue, endTimeValue);
        var weatherValue = getStoredWeatherSummary();
        if (!weatherValue) {
          weatherValue = "Sin datos";
        }
        var header = [
          "Fecha",
          "Hora Arranque",
          "Hora Fin",
          "Duracion",
          "Clima",
          "Ejercicio",
          "Serie",
          "Repeticiones",
          "Peso",
          "Peso Barra",
          "Fase del Ciclo"
        ];
        var data = [header];
        var exerciseRows = collectExerciseRows();

        exerciseRows.forEach(function (row) {
          data.push([
            dateValue,
            startTimeValue,
            endTimeValue,
            durationValue,
            weatherValue,
            row.ejercicio,
            row.serie,
            row.repeticiones,
            row.peso,
            row.pesoBarra,
            cyclePhase
          ]);
        });

        var workbook = XLSX.utils.book_new();
        var sheet = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, sheet, "Entrenamiento");
        var filename = "entrenamiento_" + dateValue + ".xlsx";
        XLSX.writeFile(workbook, filename);
      });
    }

    initCyclePhaseToggle();
    initTimerSection();
    initWorkoutTimer();
    initTimeButtons();
    initExportButton();
    initWorkoutFileLoader();
  })();
