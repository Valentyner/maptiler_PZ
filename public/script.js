let selectedTool = null;
let currentMarker = null;
let currentTooltip = null;
let currentPosition = null;

function selectTool(tool) {
  selectedTool = tool;
}

maptilersdk.config.apiKey = '1GE8kkRVIxwHhspELnK8';

const map = new maptilersdk.Map({
  container: 'map',
  style: maptilersdk.MapStyle.BASIC,
  center: [30.52, 50.45],
  zoom: 6
});

fetch('/api/markers')
  .then(res => res.json())
  .then(data => data.forEach(marker => addMarker(marker)));

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

  marker.setDraggable(false);

  currentMarker = marker;
  currentTooltip = tooltip;
  currentPosition = { lng: data.lng, lat: data.lat };

  const menu = document.getElementById('contextMenu');
  menu.style.top = `${e.pageY}px`;
  menu.style.left = `${e.pageX}px`;
  menu.style.display = 'block';

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