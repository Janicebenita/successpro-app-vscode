from google import genai

key = "AQ.Ab8RN6JK-keE1bnB0wzal7YqHkE9p8dVel6Kg0mHW41_f_lhKA"
client = genai.Client(api_key=key)

for m in ["gemini-2.5-flash-lite", "gemini-3.5-flash-lite", "gemini-3.5-flash"]:
    try:
        res = client.models.generate_content(model=m, contents="Say hello in one word")
        print(f"Model {m} SUCCESS:", res.text.strip())
        break
    except Exception as e:
        print(f"Model {m} failed:", e)
