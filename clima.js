(function () {
  var WEATHER_STORAGE_KEY = "workoutWeatherSnapshot";
  var WEATHER_API_KEY = "688995b93d224ff4b9c180508260601";
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

  function buildSummary(temperature, humidity, conditionText) {
    var parts = [];
    var roundedTemp = Math.round(Number(temperature));
    if (!Number.isNaN(roundedTemp)) {
      parts.push(roundedTemp + "C");
    }
    var roundedHumidity = Math.round(Number(humidity));
    if (!Number.isNaN(roundedHumidity)) {
      parts.push(roundedHumidity + "% HR");
    }
    if (conditionText) {
      parts.push(conditionText);
    }
    if (!parts.length) {
      return "Clima";
    }
    return parts.join(" - ");
  }

  function fetchWeatherForCoords(coords) {
    if (!WEATHER_API_KEY) {
      return Promise.reject(new Error("missing api key"));
    }
    var url =
      "https://api.weatherapi.com/v1/current.json?key=" +
      encodeURIComponent(WEATHER_API_KEY) +
      "&q=" +
      encodeURIComponent(coords.latitude + "," + coords.longitude) +
      "&aqi=no";
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
        if (!current || current.temp_c == null) {
          throw new Error("missing weather data");
        }
        var conditionText = current.condition && current.condition.text ? current.condition.text : "";
        var summary = buildSummary(current.temp_c, current.humidity, conditionText);
        var snapshot = {
          summary: summary,
          temperature: current.temp_c,
          humidity: current.humidity,
          condition: conditionText,
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
