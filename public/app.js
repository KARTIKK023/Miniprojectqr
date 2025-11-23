const video = document.getElementById("camera");
const resultBox = document.getElementById("result");
const scanBtn = document.getElementById("scanBtn");
const languageSelect = document.getElementById("language");
const laser = document.getElementById("laser");

let lastScanned = "";
let lastScanTime = 0;
const SCAN_COOLDOWN = 2000;
laser.style.display = "none";

// ZXing reader (QR + BARCODE)
const codeReader = new ZXing.BrowserMultiFormatReader();

// Text-to-speech
function speak(text, lang) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = lang === "hi" ? "hi-IN" : "en-US";
  msg.rate = 1;
  speechSynthesis.speak(msg);
}

// "Ready to scan"
function speakReady() {
  const msg = new SpeechSynthesisUtterance("Ready to scan.");
  msg.lang = "en-US";
  msg.rate = 1;
  speechSynthesis.speak(msg);
}

// Beep + vibration
function triggerFeedback() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.value = 800;
  gain.gain.value = 0.2;

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  setTimeout(() => {
    osc.stop();
    ctx.close();
  }, 150);

  if (navigator.vibrate) navigator.vibrate([150]);
}

// Glow animation
function triggerAnimation() {
  resultBox.classList.add("glow");
  setTimeout(() => resultBox.classList.remove("glow"), 800);
}

// Extract description from QR
function extractDescription(text) {
  let lines = text.split("\n");
  let descLine = lines.find(x => x.startsWith("Description:"));
  return descLine.replace("Description:", "").trim();
}

// Fetch Google results (SerpAPI)
async function fetchGoogleResults(query) {
  const API_KEY = "3af17ccea0afefe93157226a6e49e1219f851a616657f02fa4ce7d9f73e965d1";  // <--- INSERT YOUR SERPAPI KEY HERE

  const url = `/api/barcode?code=${barcode}`;




  const res = await fetch(url);
  const data = await res.json();
  return data;
}

// Process scanned data
async function processData(text) {
  const now = Date.now();

  // Prevent duplicates
  if (text === lastScanned && now - lastScanTime < SCAN_COOLDOWN) return;

  lastScanned = text;
  lastScanTime = now;

  triggerFeedback();
  triggerAnimation();

  let lang = languageSelect.value;
  resultBox.innerHTML = `<b>Scanned:</b><br>${text}`;


  // 1️⃣ UPI QR
  if (text.startsWith("upi://pay")) {
    const url = new URL(text);

    const upiID = url.searchParams.get("pa") || "";
    let name = decodeURIComponent(url.searchParams.get("pn") || "");

    // Extract phone ANYWHERE in QR
    let phone = "";
    let phoneMatch = text.match(/\b[6-9]\d{9}\b/);
    if (phoneMatch) phone = phoneMatch[0];

    // Extract if UPI ID begins with digits
    if (!phone && /^\d{10}/.test(upiID)) {
      phone = upiID.match(/\d{10}/)[0];
    }

    resultBox.innerHTML = `
      <b>UPI QR Detected</b><br><br>
      <b>Name:</b> ${name || "Not available"}<br>
      <b>UPI ID:</b> ${upiID}<br>
      <b>Phone:</b> ${phone || "Not found"}<br><br>
      <a href="${text}" target="_blank">Open in UPI App</a>
    `;

    let speakText = "UPI code detected. ";
    if (name) speakText += "Payment to " + name + ". ";
    if (phone) speakText += "Phone number " + phone + ". ";

    speak(speakText, lang);
    return;
  }


  // 2️⃣ QR WITH DESCRIPTION
  if (text.includes("Description:")) {
    const desc = extractDescription(text);
    speak(desc, lang);
    return;
  }


  // 3️⃣ PRODUCT ID (Backend)
  if (text.startsWith("ID:")) {
    const id = text.replace("ID:", "").trim();
    fetchDescription(id, lang);
    return;
  }


  // 4️⃣ BARCODE → GOOGLE SEARCH
  // 4️⃣ BARCODE → FREE PRODUCT API (NO BACKEND NEEDED)
// 4️⃣ UNIVERSAL BARCODE LOOKUP (3 APIs)
// 4️⃣ UNIVERSAL PRODUCT LOOKUP (BACKEND)
if (/^\d+$/.test(text)) {
    const barcode = text;

    resultBox.innerHTML = `<b>Barcode:</b> ${barcode}<br><br>Fetching product...`;

    speak("Barcode detected", lang);

    const url = `/api/barcode?code=${barcode}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            resultBox.innerHTML = `
                <b>Barcode:</b> ${barcode}<br><br>
    <span>No product details found.</span><br><br>
    <a 
      href="https://www.google.com/search?q=${barcode}+product" 
      target="_blank" 
      style="
        background:#00e79a;
        color:black;
        padding:10px 15px;
        border-radius:8px;
        font-weight:600;
        text-decoration:none;
      "
    >
      🔍 Search on Google
    </a>
            `;
            return;
        }

        const p = data.product;
        if(p.product_name === undefined && p.title === undefined && p.brand === undefined){
            resultBox.innerHTML = `
                <b>Barcode:</b> ${barcode}<br><br>
    <span>No product details found.</span><br><br>
    <a 
      href="https://www.google.com/search?q=${barcode}+product" 
      target="_blank" 
      style="
        background:#00e79a;
        color:black;
        padding:10px 15px;
        border-radius:8px;
        font-weight:600;
        text-decoration:none;
      "
    >
      🔍 Search on Google
    </a>
            `;
            return;
        }

        resultBox.innerHTML = `
            <b>Product Found (${data.source})</b><br><br>
            <b>Name:</b> ${p.product_name || p.title || p.brand || "Unknown"} <br><br>
            ${p.image_url || p.images ? `<img src="${p.image_url || p.images[0]}" width="150"><br><br>` : ""}
            <b>Brand:</b> ${p.brand || p.brands || "Unknown"}<br>
            <b>Category:</b> ${p.category || p.categories || "Unknown"}<br><br>
        `;

        speak(p.product_name || p.title || "Product found", lang);

    } catch (err) {
        resultBox.innerHTML = `<b>Error fetching product.</b>`;
    }

    return;
}





  // 5️⃣ Fallback: Normal QR
  speak(text, lang);
}

// Backend fetch for product ID
async function fetchDescription(id, lang) {
  try {
    const res = await fetch(`/api/products/${id}?lang=${lang}`);
    const data = await res.json();

    resultBox.innerHTML = `<b>${data.name}</b><br><br>${data.description}`;
    speak(data.description, lang);

  } catch (err) {
    resultBox.innerHTML = "Error fetching product details.";
  }
}

// Start scanning
async function startScanning() {
  try {
    const devices = await codeReader.listVideoInputDevices();

    if (!devices.length) {
      resultBox.innerHTML = "No camera found.";
      return;
    }

    // Back camera (usually last)
    const cameraId = devices[devices.length - 1].deviceId;

    await codeReader.decodeFromVideoDevice(cameraId, "camera", (result, err) => {
      if (result) processData(result.getText());
    });

  } catch (error) {
    resultBox.innerHTML = "Camera error: " + error;
  }
}

// Start button
scanBtn.addEventListener("click", async () => {
  laser.style.display = "block";

  speakReady();

  setTimeout(() => {
    startScanning();
  }, 600);
});

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");
  });
});

