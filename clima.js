(function () {
  var WEATHER_STORAGE_KEY = "workoutWeatherSnapshot";
  var button = document.getElementById("weather-refresh-button");
  var statusLabel = document.getElementById("weather-status");
  var updatedLabel = document.getElementById("weather-updated");

  if (!button || !statusLabel) {
    return;
  }

  function formatTime(date) {
    var hours = String(date.getHours()).padStart(2, "0");
    var minutes = String(date.getMinutes()).padStart(2, "0");
    return hours + ":" + minutes;
  }

  function setStatus(text) {
    statusLabel.textContent = text || "";
  }

  function setUpdated(text) {
    if (!updatedLabel) {
      return;
    }
    updatedLabel.textContent = text || "";
  }

  function setLoadingState(isLoading) {
    button.disabled = isLoading;
    button.classList.toggle("opacity-70", isLoading);
    button.classList.toggle("cursor-wait", isLoading);
    button.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  function readSnapshot() {
    if (!window.sessionStorage) {
      return null;
    }
    var raw = sessionStorage.getItem(WEATHER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function writeSnapshot(snapshot) {
    if (!window.sessionStorage) {
      return;
    }
    try {
      sessionStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      return;
    }
  }

  function applySnapshot(snapshot) {
    if (!snapshot || !snapshot.summary) {
      setStatus("Sin datos");
      setUpdated("");
      return;
    }
    setStatus(snapshot.summary);
    if (snapshot.updatedAt) {
      var updatedDate = new Date(snapshot.updatedAt);
      if (!Number.isNaN(updatedDate.getTime())) {
        var updatedText = "Actualizado " + formatTime(updatedDate);
        if (snapshot.note) {
          updatedText += " (" + snapshot.note + ")";
        }
        setUpdated(updatedText);
        return;
      }
    }
    setUpdated("");
  }

  function getWeatherLabel(code) {
    var weatherCode = parseInt(code, 10);
    if (Number.isNaN(weatherCode)) {
      return "";
    }
    if (weatherCode === 0) {
      return "Despejado";
    }
    if (weatherCode === 1 || weatherCode === 2) {
      return "Mayormente despejado";
    }
    if (weatherCode === 3) {
      return "Nublado";
    }
    if (weatherCode === 45 || weatherCode === 48) {
      return "Neblina";
    }
    if (weatherCode >= 51 && weatherCode <= 57) {
      return "Llovizna";
    }
    if (weatherCode >= 61 && weatherCode <= 67) {
      return "Lluvia";
    }
    if (weatherCode >= 71 && weatherCode <= 77) {
      return "Nieve";
    }
    if (weatherCode >= 80 && weatherCode <= 82) {
      return "Chubascos";
    }
    if (weatherCode === 85 || weatherCode === 86) {
      return "Nieve ligera";
    }
    if (weatherCode === 95) {
      return "Tormenta";
    }
    if (weatherCode === 96 || weatherCode === 99) {
      return "Tormenta con granizo";
    }
    return "Clima";
  }

  function buildSummary(temperature, code) {
    var label = getWeatherLabel(code);
    var rounded = Math.round(Number(temperature));
    if (Number.isNaN(rounded)) {
      return label || "Clima";
    }
    if (label) {
      return rounded + "C - " + label;
    }
    return rounded + "C";
  }

  function fetchWeatherForCoords(coords) {
    var url =
      "https://api.open-meteo.com/v1/forecast?latitude=" +
      encodeURIComponent(coords.latitude) +
      "&longitude=" +
      encodeURIComponent(coords.longitude) +
      "&current=temperature_2m,weathercode,apparent_temperature&timezone=auto";
    return fetch(url, { headers: { Accept: "application/json" } }).then(function (response) {
      if (!response.ok) {
        throw new Error("weather request failed");
      }
      return response.json();
    });
  }

  function applyWeatherFromCoords(coords, note) {
    return fetchWeatherForCoords(coords)
      .then(function (data) {
        var current = data && data.current ? data.current : null;
        if (!current || current.temperature_2m == null) {
          throw new Error("missing weather data");
        }
        var summary = buildSummary(current.temperature_2m, current.weathercode);
        var snapshot = {
          summary: summary,
          temperature: current.temperature_2m,
          code: current.weathercode,
          updatedAt: new Date().toISOString(),
          latitude: coords.latitude,
          longitude: coords.longitude,
          note: note || ""
        };
        writeSnapshot(snapshot);
        applySnapshot(snapshot);
        setLoadingState(false);
      })
      .catch(function () {
        setStatus("No se pudo obtener clima");
        setUpdated("");
        setLoadingState(false);
      });
  }

  function getStoredCoords() {
    var snapshot = readSnapshot();
    if (!snapshot) {
      return null;
    }
    var latitude = Number(snapshot.latitude);
    var longitude = Number(snapshot.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return { latitude: latitude, longitude: longitude };
  }

  function updateWeather() {
    setLoadingState(true);
    setStatus("Actualizando...");
    setUpdated("");

    if (!navigator.geolocation) {
      var storedCoords = getStoredCoords();
      if (storedCoords) {
        setStatus("Usando ultima ubicacion");
        applyWeatherFromCoords(storedCoords, "ultima ubicacion");
        return;
      }
      setStatus("Geolocalizacion no disponible");
      setLoadingState(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function (position) {
        var coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        applyWeatherFromCoords(coords, "");
      },
      function (error) {
        var message = "No se pudo obtener ubicacion";
        if (error && error.code === 1) {
          message = "Permiso de ubicacion denegado";
        } else if (error && error.code === 3) {
          message = "Tiempo de espera de ubicacion";
        }
        var storedCoords = getStoredCoords();
        if (storedCoords) {
          setStatus("Usando ultima ubicacion");
          applyWeatherFromCoords(storedCoords, "ultima ubicacion");
          return;
        }
        setStatus(message);
        setUpdated("");
        setLoadingState(false);
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 }
    );
  }

  applySnapshot(readSnapshot());
  button.addEventListener("click", updateWeather);
})();
