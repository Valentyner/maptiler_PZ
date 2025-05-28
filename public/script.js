let selectedTool = null;
let currentMarker = null;
let currentTooltip = null;
let currentPosition = null;

// Cховище для файлів
let uploadedFiles = [];

let map = null;

function selectTool(tool) {
  selectedTool = tool;
}

async function getApi() {
  let response = await fetch('/api/apikey');
  let data = await response.json();
  return data.apiKey;
}

async function getListVideo() {
  let response = await fetch('/api/video');
  let data = await response.json();
  return data;
}

async function init() {
  const MAP_TIMEOUT = 5000; // 5 секунд

  const apiKey = await getApi()
  maptilersdk.config.apiKey = apiKey;

  map = new maptilersdk.Map({
    container: 'map',
    style: maptilersdk.MapStyle.BASIC,
    center: [30.52, 50.45],
    zoom: 6
  });


  const timeout = setTimeout(() => {
    if (!map.isStyleLoaded()) {
      console.error("⏰ Map style loading timeout");
      alert("Мапа не завантажилась, спробуйте оновити сторінку.");
      // Можна показати заглушку або перезавантажити
    }
  }, MAP_TIMEOUT);

  map.on('load', () => {
    clearTimeout(timeout);
    console.log('✅ Map loaded successfully');
    // Тут додавай шари, джерела
  });

  map.on('click', async (e) => {
    if (!selectedTool) return;

    const date = prompt("Дата фіксації:", new Date().toISOString().slice(0, 10));
    if (!date) return;
    const time = prompt("Час фіксації:", new Date().toTimeString().slice(0, 5));
    if (!time) return;

    const markerData = {
      type: selectedTool,
      date,
      time,
      lat: e.lngLat.lat,
      lng: e.lngLat.lng
    };

    addMarker(markerData);

    fetch('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(markerData)
    });
  });

  uploadedFiles = await getListVideo();

  fetch('/api/markers')
    .then(res => res.json())
    .then(data => data.forEach(marker => addMarker(marker)));

  map.on('load', function () {
    document.getElementById('routeUpload').addEventListener('change', function (event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const geojson = JSON.parse(e.target.result);
          if (map.getSource('bplaRoute')) {
            map.removeLayer('bplaRoute');
            map.removeSource('bplaRoute');
          }

          map.addSource('bplaRoute', {
            type: 'geojson',
            data: geojson
          });

          map.addLayer({
            id: 'bplaRoute',
            type: 'line',
            source: 'bplaRoute',
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': '#ff8800',
              'line-width': 4
            }
          });

          const coordinates = geojson.geometry.coordinates;
          if (coordinates.length > 0) {
            map.flyTo({ center: coordinates[0], zoom: 14 });
          }
        } catch (err) {
          alert("Invalid JSON file format");
        }
      };
      reader.readAsText(file);
    });
  });

  map.on('load', () => {
    fetch('route.json') // шлях до JSON (має бути у public або доступний через express.static)
      .then(response => {
        if (!response.ok) throw new Error("Route file not found");
        return response.json();
      })
      .then(geojson => {
        map.addSource('bplaRoute', {
          type: 'geojson',
          data: geojson
        });

        map.addLayer({
          id: 'bplaRoute',
          type: 'line',
          source: 'bplaRoute',
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#ff8800',
            'line-width': 4
          }
        });

        const coords = geojson.geometry.coordinates;
        if (coords.length > 0) {
          map.flyTo({ center: coords[0], zoom: 14 });
        }
      })
      .catch(err => {
        console.error("Cannot load route.json:", err.message);
      });

    map.on('click', 'bplaRoute', () => {
      window.open('/bpla-viewer.html', '_blank'); // або відкрий модальне вікно
      map.setPaintProperty('bplaRoute', 'line-color', '#00ff00');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});

// Завантажити маркери з сервера
function addMarker(data) {
  const el = document.createElement('img');
  el.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
      e.stopPropagation();
    }
  });

  el.src = `icons/${data.type}.png`;
  el.style.width = '30px';
  el.style.cursor = 'pointer';

  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.innerText = `Тип: ${data.type.toUpperCase()}\nДата: ${data.date}\nЧас: ${data.time}`;
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  el.addEventListener('mouseenter', () => tooltip.style.display = 'block');
  el.addEventListener('mouseleave', () => tooltip.style.display = 'none');
  el.addEventListener('mousemove', (e) => {
    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY + 10}px`;
  });

  const marker = new maptilersdk.Marker({
    element: el,
    draggable: true
  }).setLngLat([data.lng, data.lat]).addTo(map);

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    // 🚫 Тимчасово вимикаємо перетягування
    marker.setDraggable(false);

    currentMarker = marker;
    currentTooltip = tooltip;
    currentPosition = { lng: data.lng, lat: data.lat };

    const menu = document.getElementById('contextMenu');
    menu.style.top = `${e.pageY}px`;
    menu.style.left = `${e.pageX}px`;
    menu.style.display = 'block';

    // ✅ Повертаємо drag після зняття курсора
    el.addEventListener('mouseleave', () => {
      marker.setDraggable(true);
    }, { once: true });
  });


  marker.on('dragend', () => {
    const newLngLat = marker.getLngLat();
    const newDate = prompt("Нова дата:", new Date().toISOString().slice(0, 10));
    const newTime = prompt("Новий час:", new Date().toTimeString().slice(0, 5));

    if (newDate && newTime) {
      tooltip.innerText = `Тип: ${data.type.toUpperCase()}\nДата: ${newDate}\nЧас: ${newTime}`;

      fetch('/api/markers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: data.lat, lng: data.lng })
      }).then(() => {
        fetch('/api/markers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: data.type,
            date: newDate,
            time: newTime,
            lat: newLngLat.lat,
            lng: newLngLat.lng
          })
        });
      });

      data.lat = newLngLat.lat;
      data.lng = newLngLat.lng;
      data.date = newDate;
      data.time = newTime;
    }
  });
}

document.addEventListener('click', () => {
  document.getElementById('contextMenu').style.display = 'none';
});

document.getElementById('editMarker').addEventListener('click', () => {
  if (!currentMarker || !currentTooltip || !currentPosition) return;

  currentMarker.setDraggable(false);

  const newDate = prompt("Нова дата:", new Date().toISOString().slice(0, 10));
  const newTime = prompt("Новий час:", new Date().toTimeString().slice(0, 5));
  if (!newDate || !newTime) return;

  const img = currentMarker.getElement();
  const currentType = img.src.split('/').pop().split('.')[0];

  currentTooltip.innerText = `Тип: ${currentType.toUpperCase()}\nДата: ${newDate}\nЧас: ${newTime}`;

  fetch('/api/markers', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentPosition)
  }).then(() => {
    fetch('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: currentType,
        date: newDate,
        time: newTime,
        lat: currentPosition.lat,
        lng: currentPosition.lng
      })
    });
  });

  img.addEventListener('mouseleave', () => {
    currentMarker.setDraggable(true);
  }, { once: true });
});

document.getElementById('deleteMarker').addEventListener('click', () => {
  if (currentMarker && currentPosition) {
    currentMarker.remove();
    currentTooltip.remove();
    fetch('/api/markers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentPosition)
    });
  }
});

document.getElementById('markDestroyed').addEventListener('click', () => {
  if (!currentMarker || !currentTooltip || !currentPosition) return;

  const newDate = prompt("Дата знищення:", new Date().toISOString().slice(0, 10));
  const newTime = prompt("Час знищення:", new Date().toTimeString().slice(0, 5));
  if (!newDate || !newTime) return;

  const img = currentMarker.getElement();
  const originalType = img.src.split('/').pop().split('.')[0].replace('_red', '');
  const newType = `${originalType}_destroyed`;

  img.src = `icons/${newType}.png`;

  currentMarker.setDraggable(false);
  img.style.pointerEvents = "none";

  currentTooltip.innerText = `Тип: ${originalType.toUpperCase()} (знищений)\nДата: ${newDate}\nЧас: ${newTime}`;

  fetch('/api/markers', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentPosition)
  }).then(() => {
    fetch('/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: newType,
        date: newDate,
        time: newTime,
        lat: currentPosition.lat,
        lng: currentPosition.lng
      })
    });
  });
});

document.getElementById("generateReport").addEventListener("click", () => {
  fetch("/generate-pdf")
    .then(res => {
      if (!res.ok) throw new Error("Помилка створення звіту");
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "otu_report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => alert("Помилка: " + err.message));
});

// Кнопки та елементи
const toggleFormBtn = document.getElementById('toggleFormBtn');
const flightForm = document.getElementById('flightForm');
const showListBtn = document.getElementById('showListBtn');
const fileList = document.getElementById('fileList');
const fileListItems = document.getElementById('fileListItems');

// Показ/приховування форми
toggleFormBtn.addEventListener('click', () => {
  flightForm.style.display = (flightForm.style.display === 'none') ? 'block' : 'none';
});

// Обробка завантаження файлу
flightForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const otuv = document.getElementById('otuv').value;
  const direction = document.getElementById('direction').value;
  const file = document.getElementById('videoInput').files[0];

  if (!otuv || !direction || !file) {
    alert('Заповніть всі поля!');
    return;
  }

  const formData = new FormData();
  formData.append('otuv', otuv);
  formData.append('direction', direction);
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  const result = await res.json();
  if (result.success) {
    alert(`✅ Завантажено: ${result.saved.fileName}`);
    flightForm.reset();
    flightForm.style.display = 'none';
    uploadedFiles.push(result.saved)
  } else {
    alert('❌ Помилка завантаження');
  }
});

async function setVideo(fileName) {
  const frame = document.getElementById('videoFrame');
  const img = frame.querySelector('img');

  img.src = `/uploads/${fileName}`; // або повний шлях, якщо на хості
  frame.style.display = 'block';
}

// Перегляд списку
showListBtn.addEventListener('click', () => {
  fileListItems.innerHTML = ''; // Очистити попередній список
  if (uploadedFiles.length === 0) {
    fileListItems.innerHTML = `<li class="list-group-item text-muted">Немає файлів</li>`;
  } else {
    uploadedFiles.forEach(file => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.innerText = `📁 ${file.otuv} | ${file.direction} → ${file.fileName}`;

      li.addEventListener('click', () => {
        setVideo(file.fileName);
      });

      fileListItems.appendChild(li);
    });
  }

  fileList.style.display = (fileList.style.display === 'none') ? 'block' : 'none';
});

// Закрити превʼю
document.querySelector('#videoFrame .btn-danger').addEventListener('click', () => {
  const frame = document.getElementById('videoFrame');
  const img = frame.querySelector('img');

  img.src = '';
  frame.style.display = 'none';
});
