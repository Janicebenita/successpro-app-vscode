import sys
from pathlib import Path

# Ensure processing directory is always on python sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from resume_worker.worker import main

if __name__ == "__main__":
    main()

