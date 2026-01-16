import dotenv from "dotenv";
dotenv.config();

/* ----------------------------------
   Load ALL Groq keys automatically
----------------------------------- */
const GROQ_KEYS = Object.entries(process.env)
  .filter(([key, value]) => key.startsWith("GROQ_API_KEY_") && value)
  .map(([_, value]) => value);

if (GROQ_KEYS.length === 0) {
  throw new Error("❌ No GROQ API keys found in .env");
}

console.log(`🔐 Loaded ${GROQ_KEYS.length} Groq API keys`);

/* ----------------------------------
   Round-robin key rotation
----------------------------------- */
let currentIndex = 0;
function getNextGroqKey() {
  const key = GROQ_KEYS[currentIndex];
  currentIndex = (currentIndex + 1) % GROQ_KEYS.length;
  return key;
}

/* ----------------------------------
   Test Groq API
----------------------------------- */
async function testGroqAPI() {
  console.log("\n🤖 Testing Groq API...\n");

  const url = "https://api.groq.com/openai/v1/chat/completions";

  try {
    const apiKey = getNextGroqKey();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Say hello in one word" }],
        max_tokens: 10,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Groq API request failed");
    }

    console.log("✅ GROQ SUCCESS!");
    console.log("Response:", data.choices[0].message.content);
    console.log("Model:", data.model);
    console.log("Tokens Used:", data.usage.total_tokens);

  } catch (err) {
    console.error("❌ GROQ ERROR:", err.message);
  }
}

/* ----------------------------------
   Test Geoapify API
----------------------------------- */
async function testGeoapifyAPI() {
  console.log("\n🌍 Testing Geoapify API...\n");

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    console.error("❌ GEOAPIFY_API_KEY not found in .env");
    return;
  }

  const url = `https://api.geoapify.com/v1/geocode/search?text=New%20Delhi&limit=1&apiKey=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.features?.length) {
      throw new Error("Geoapify API request failed");
    }

    const place = data.features[0];

    console.log("✅ GEOAPIFY SUCCESS!");
    console.log("Place:", place.properties.formatted);
    console.log("Latitude:", place.geometry.coordinates[1]);
    console.log("Longitude:", place.geometry.coordinates[0]);

  } catch (err) {
    console.error("❌ GEOAPIFY ERROR:", err.message);
  }
}

/* ----------------------------------
   Test Mappls API (MapMyIndia)
----------------------------------- */
async function testMapplsAPI() {
  console.log("\n🗺️ Testing Mappls API...\n");

  const apiKey = process.env.MAPPLS_API_KEY;
  if (!apiKey) {
    console.error("❌ MAPPLS_API_KEY not found in .env");
    return;
  }

  const url = `https://atlas.mappls.com/api/places/search/json?query=New%20Delhi`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.suggestedLocations?.length) {
      throw new Error("Mappls API request failed");
    }

    const place = data.suggestedLocations[0];

    console.log("✅ MAPPLS SUCCESS!");
    console.log("Place:", place.placeName);
    console.log("Latitude:", place.latitude);
    console.log("Longitude:", place.longitude);

  } catch (err) {
    console.error("❌ MAPPLS ERROR:", err.message);
  }
}

/* ----------------------------------
   Run All Tests
----------------------------------- */
(async () => {
  await testGroqAPI();
  await testGeoapifyAPI();
  await testMapplsAPI();
})();
