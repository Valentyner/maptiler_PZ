// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Завантаження всіх маркерів
app.get("/api/markers", (req, res) => {
  const filePath = path.join(__dirname, "markers.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Cannot read file" });
    res.json(JSON.parse(data));
  });
});

// Додавання нового маркера
app.post("/api/markers", (req, res) => {
  const newMarker = req.body;
  const filePath = path.join(__dirname, "markers.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Cannot read file" });
    const markers = JSON.parse(data);
    markers.push(newMarker);
    fs.writeFile(filePath, JSON.stringify(markers, null, 2), () => {
      res.json({ success: true });
    });
  });
});

// Видалення маркера
app.delete("/api/markers", (req, res) => {
  const { lng, lat } = req.body;
  const filePath = path.join(__dirname, "markers.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Cannot read file" });
    let markers = JSON.parse(data);
    markers = markers.filter(m => !(m.lat === lat && m.lng === lng));
    fs.writeFile(filePath, JSON.stringify(markers, null, 2), () => {
      res.json({ success: true });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
