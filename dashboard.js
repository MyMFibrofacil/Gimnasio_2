(function () {
    function initWorkoutFileLoader() {
      var overlay = document.getElementById("file-loader-overlay");
      var fileInput = document.getElementById("workout-file-input");
      var daySelect = document.getElementById("workout-day-select");
      var daySelectMain = document.getElementById("workout-day-select-main");
      var errorText = document.getElementById("workout-file-error");
      var exerciseList = document.getElementById("exercise-list");
      var categoryTemplate = document.getElementById("exercise-category-template");
      var exerciseTemplate = document.getElementById("exercise-template");

      if (!overlay || !fileInput || !daySelect || !daySelectMain || !errorText || !exerciseList || !categoryTemplate || !exerciseTemplate) {
        return;
      }

      var currentWorkbook = null;
      var repsColumns = [3, 4, 5, 6, 7, 8];

      function setOverlayVisible(isVisible) {
        overlay.style.display = isVisible ? "flex" : "none";
      }

      function showError(message) {
        errorText.textContent = message || "";
        errorText.hidden = !message;
      }

      function resetDaySelect(select) {
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
          var option = document.createElement("option");
          option.value = sheetName;
          option.textContent = sheetName;
          daySelect.appendChild(option);

          var optionMain = document.createElement("option");
          optionMain.value = sheetName;
          optionMain.textContent = sheetName;
          daySelectMain.appendChild(optionMain);
        });
        var shouldDisable = sheetNames.length === 0;
        daySelect.disabled = shouldDisable;
        daySelectMain.disabled = shouldDisable;
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

      function syncDaySelects(selectedSheet) {
        if (daySelect.value !== selectedSheet) {
          daySelect.value = selectedSheet;
        }
        if (daySelectMain.value !== selectedSheet) {
          daySelectMain.value = selectedSheet;
        }
      }

      function handleDaySelection(selectedSheet) {
        if (!selectedSheet) {
          return;
        }

        var exercises = parseExercisesFromWorkbook(selectedSheet);
        if (!exercises) {
          return;
        }

        renderExercises(exercises);
        showError("");
        setOverlayVisible(false);
        syncDaySelects(selectedSheet);
      }

      daySelect.addEventListener("change", function () {
        handleDaySelection(daySelect.value);
      });

      daySelectMain.addEventListener("change", function () {
        handleDaySelection(daySelectMain.value);
      });

      fileInput.addEventListener("change", function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }

        showError("");
        resetDaySelects();
        currentWorkbook = null;
        setOverlayVisible(true);

        if (!/\.xlsx$/i.test(file.name)) {
          showError("El archivo debe ser .xlsx.");
          return;
        }

        var reader = new FileReader();
        reader.onload = function () {
          try {
            currentWorkbook = XLSX.read(reader.result, { type: "array" });
            var sheetNames = currentWorkbook.SheetNames || [];
            if (!sheetNames.length) {
              showError("El archivo no contiene hojas.");
              return;
            }

            populateDaySelects(sheetNames);
            if (sheetNames.length === 1) {
              handleDaySelection(sheetNames[0]);
            }
          } catch (error) {
            showError("No se pudo leer el archivo. Verifica que sea .xlsx valido.");
          }
        };
        reader.readAsArrayBuffer(file);
      });

      resetDaySelects();
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
        var header = ["Fecha", "Clima", "Ejercicio", "Serie", "Repeticiones", "Peso", "Peso Barra", "Fase del Ciclo"];
        var data = [header];
        var exerciseRows = collectExerciseRows();

        exerciseRows.forEach(function (row) {
          data.push([
            dateValue,
            0,
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
