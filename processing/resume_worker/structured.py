from __future__ import annotations
from typing import Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from .models import PageExtraction

class ProfileField(BaseModel):
    name: str
    value: str
    pages: list[int]
    evidence: list[str]

class ProfileChunk(BaseModel):
    fields: list[ProfileField]
    warnings: list[str] = Field(default_factory=list)

def normalize_profile_chunk(payload: Any, pages: list[PageExtraction]) -> dict[str,Any]:
    if isinstance(payload,list):
        if len(payload)==1 and isinstance(payload[0],dict) and ("profile" in payload[0] or "fields" in payload[0]):payload=payload[0]
        elif all(isinstance(item,dict) and "name" in item for item in payload):payload={"fields":payload}
        else:raise ValueError("Profile response list must contain named evidence fields")
    if not isinstance(payload,dict):raise ValueError("Profile response must be an object or named field list")
    warnings=list(payload.get("warnings") or [])
    fields=payload.get("fields")
    if fields is None:
        profile=payload.get("profile",{});evidence=payload.get("evidence",{})
        if not isinstance(profile,dict) or not isinstance(evidence,dict):raise ValueError("Profile and evidence must be dictionaries")
        fields=[{"name":key,"value":value,"pages":evidence.get(key,[]),"evidence":[value] if isinstance(value,str) else []} for key,value in profile.items()]
    if not isinstance(fields,list):raise ValueError("Profile fields must be a list")
    source={p.page:p.text for p in pages};profile={};evidence={};provenance={}
    for raw in fields:
        try:field=ProfileField.model_validate(raw)
        except Exception:
            warnings.append("Rejected malformed profile field");continue
        valid=bool(field.value.strip() and field.pages and field.evidence) and len(set(field.pages))==len(field.pages) and all(p in source for p in field.pages)
        valid=valid and any(field.value in source[p] for p in field.pages) and all(any(quote in source[p] for p in field.pages) for quote in field.evidence if quote.strip()) and all(q.strip() for q in field.evidence)
        if not valid or field.name in profile:
            warnings.append("Rejected unsupported or duplicate field: "+field.name);continue
        profile[field.name]=field.value;evidence[field.name]=field.pages;provenance[field.name]=field.evidence
    return {"profile":profile,"evidence":evidence,"provenance":provenance,"warnings":warnings}

def provider_metadata(response, model: str) -> dict[str,Any]:
    usage=getattr(response,"usage_metadata",None)
    return {"provider":"gemini","model":model,"timestamp":datetime.now(timezone.utc).isoformat(),"response_id":getattr(response,"response_id",None),"input_tokens":getattr(usage,"prompt_token_count",None),"output_tokens":getattr(usage,"candidates_token_count",None)}
