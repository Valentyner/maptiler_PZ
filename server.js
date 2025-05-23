const express = require("express");
const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.get("/api/markers", (req, res) => {
  const filePath = path.join(__dirname, "markers.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Cannot read file" });
    res.json(JSON.parse(data));
  });
});

function getOTUV(lat, lng) {
  if (lat > 50.46 && lng < 30.60) return "ОТУВ «Північ»";
  if (lat <= 50.46 && lng < 30.60) return "ОТУВ «Захід»";
  if (lng >= 30.60 && lat > 50.46) return "ОТУВ «Схід»";
  return "ОТУВ «Південь»";
}
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 600 });

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

app.get("/generate-pdf", async (req, res) => {
  const raw = fs.readFileSync("markers.json", "utf8");
  const data = JSON.parse(raw);

  const otuCounts = {};

  data.forEach(({ lat, lng, type }) => {
    const otu = getOTUV(lat, lng);
    const destroyed = type.endsWith("_destroyed");

    if (!otuCounts[otu]) {
      otuCounts[otu] = { destroyed: 0, active: 0 };
    }

    if (destroyed) {
      otuCounts[otu].destroyed++;
    } else {
      otuCounts[otu].active++;
    }
  });

  const labels = Object.keys(otuCounts);
  const activeData = labels.map(otu => otuCounts[otu].active);
  const destroyedData = labels.map(otu => otuCounts[otu].destroyed);

  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Активна техніка",
          data: activeData,
          backgroundColor: "black",
        },
        {
          label: "Знищена техніка",
          data: destroyedData,
          backgroundColor: "red",
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: {
          position: "top",
        },
        title: {
          display: true,
          text: "Кількість техніки по ОТУВ",
        },
      },
    },
  };

  const image = await chartJSNodeCanvas.renderToBuffer(config);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([800, 600]);
  const png = await pdfDoc.embedPng(image);
  page.drawImage(png, { x: 0, y: 0, width: 800, height: 600 });

  const pdfBytes = await pdfDoc.save();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=otu_summary.pdf");
  res.send(pdfBytes);
});

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
