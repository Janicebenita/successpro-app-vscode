from __future__ import annotations
import hashlib, marshal, os, sys
from datetime import datetime, timezone
from pathlib import Path

def identity():
    modules={}
    for name in ("worker","ai","extraction","models","visual","structured"):
        module=sys.modules.get("resume_worker."+name)
        if not module or not getattr(module,"__file__",None):continue
        path=Path(module.__file__).resolve()
        functions={key:hashlib.sha256(marshal.dumps(value.__code__)).hexdigest() for key,value in vars(module).items() if callable(value) and hasattr(value,"__code__") and value.__module__==module.__name__}
        modules[name]={"path":str(path),"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"loaded_functions":functions}
    paths=[Path(__file__).with_name(name) for name in ("ai.py","extraction.py","models.py","runtime_identity.py","structured.py","visual.py","worker.py","workbook_visual_rubric.json")]
    revision=hashlib.sha256("".join(p.name+":"+hashlib.sha256(p.read_bytes()).hexdigest()+"\n" for p in sorted(paths,key=lambda p:p.name)).encode()).hexdigest()
    return {"source_revision":revision,"version":"successpro-integration-phase3-v1","pid":os.getpid(),"parent_pid":os.getppid(),"python":sys.executable,"started_utc":datetime.now(timezone.utc).isoformat(),"modules":modules}
