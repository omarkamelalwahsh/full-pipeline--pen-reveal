async function test() {
  try {
    console.log("Testing /api/pipeline/create...");
    const response = await fetch("http://localhost:3000/api/pipeline/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "Welcome to Pen-Reveal. This is scene one. Let's make it look beautiful. Here is scene two." }),
    });
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error calling /api/pipeline/create:", error);
  }
}

test();
