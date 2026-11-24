const key = "AQ.Ab8RN6IS2JfbcKnyoAoxbJ97vCI_tAoRU6tyLBJi46i6gyOhZg";
async function test() {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + key);
    const data = await res.json();
    if (data.error) {
      console.log("GEMINI ERROR:", JSON.stringify(data.error));
    } else {
      console.log("AVAILABLE MODELS:", data.models?.map(m => m.name.replace("models/", "")).filter(m => m.includes("gemini")));
    }
  } catch (err) {
    console.error("NETWORK ERROR:", err);
  }
}
test();
