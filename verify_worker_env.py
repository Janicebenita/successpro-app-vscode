import sys
sys.path.insert(0, "D:/successpro-app-vscode/processing")
from resume_worker.config import Settings

s = Settings.load()
print("Storage:", s.storage_root)
print("MySQL:", s.mysql_url)
print("Redis:", s.redis_url)
print("AI:", s.ai_provider)
