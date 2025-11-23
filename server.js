import express from "express";
import axios from "axios";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve frontend from /public folder
app.use(express.static(path.join(__dirname, "public")));

// ---------- UNIVERSAL BARCODE LOOKUP ----------
app.get("/api/barcode", async (req, res) => {
  const barcode = req.query.code;

  if (!barcode) {
    return res.status(400).json({ error: "Barcode missing" });
  }

  try {
    // API 1: OpenFoodFacts
    const off = await axios
      .get(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
      .catch(() => null);

    if (off && off.data && off.data.status === 1) {
      return res.json({
        source: "OpenFoodFacts",
        product: off.data.product,
      });
    }

    // API 2: OpenProductData
    const opd = await axios
      .get(`https://product-open-data.com/api/v1/product/${barcode}`)
      .catch(() => null);

    if (opd && opd.data && opd.data.product) {
      return res.json({
        source: "OpenProductData",
        product: opd.data.product,
      });
    }

    // API 3: UPCitemDB
    const upc = await axios
      .get(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`)
      .catch(() => null);

    if (upc && upc.data && upc.data.items && upc.data.items.length > 0) {
      return res.json({
        source: "UPCitemDB",
        product: upc.data.items[0],
      });
    }

    return res.json({ error: "Product not found in any database." });

  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Fallback → always serve frontend for unknown routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// IMPORTANT: Render will assign PORT in env
const PORT = process.env.PORT || 5003;
app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
