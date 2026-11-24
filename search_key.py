import os

found = []
for root, dirs, files in os.walk("D:/successpro-app-vscode"):
    if ".venv" in root or "node_modules" in root or ".git" in root or ".tools" in root or ".local" in root:
        continue
    for f in files:
        if f.endswith((".ts", ".tsx", ".js", ".py", ".json", ".env", ".local")):
            p = os.path.join(root, f)
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as fl:
                    content = fl.read()
                    if "AIzaSy" in content:
                        found.append(("AIzaSy", p))
                    elif "GEMINI_API_KEY" in content and "AQ." not in content and len(content) > 0:
                        lines = [l.strip() for l in content.splitlines() if "GEMINI_API_KEY" in l and not l.strip().startswith("//") and not l.strip().startswith("#")]
                        if lines:
                            found.append((lines, p))
            except Exception:
                pass

for item in found:
    print(item[1], "->", item[0])
