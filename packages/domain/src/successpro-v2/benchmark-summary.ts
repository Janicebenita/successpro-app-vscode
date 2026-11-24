import type {ParameterId} from "./types";
export interface CalibrationRun {
 provider:string;model:string;promptVersion:string;settings:Record<string,unknown>;
 score:number;ratings:Partial<Record<ParameterId,number>>;validation:"passed";fallback:false;timestamp:string;
}
const stats=(values:number[])=>{
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 return {mean,minimum:Math.min(...values),maximum:Math.max(...values),standardDeviation:Math.sqrt(values.reduce((n,v)=>n+(v-mean)**2,0)/values.length)};
};
const stable=(value:unknown):string=>Array.isArray(value)?`[${value.map(stable).join(",")}]`:value && typeof value==="object"?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stable(v)}`).join(",")}}`:JSON.stringify(value);
/** Five comparable, validated, non-fallback runs; population standard deviation (N=5). */
export function summarizeCalibrationRuns(runs:CalibrationRun[]) {
 if(runs.length!==5)throw new Error("Exactly five runs are required; do not substitute missing observations.");
 const signature=(r:CalibrationRun)=>stable({provider:r.provider,model:r.model,promptVersion:r.promptVersion,settings:r.settings});
 const first=signature(runs[0]),ids=Object.keys(runs[0].ratings).sort() as ParameterId[];
 for(const r of runs){
  if(signature(r)!==first || r.validation!=="passed" || r.fallback!==false)throw new Error("Runs must share provider, model, prompt and settings, pass validation and use no fallback.");
  if(!Number.isFinite(r.score)||r.score<0||r.score>100||!r.timestamp||stable(Object.keys(r.ratings).sort())!==stable(ids))throw new Error("Missing or invalid benchmark score, timestamp or criterion coverage.");
  if(Object.values(r.ratings).some(v=>!Number.isInteger(v)||v!<0||v!>5))throw new Error("Invalid criterion rating");
 }
 const perCriterion=Object.fromEntries(ids.map(id=>{
  const values=runs.map(r=>r.ratings[id]!);
  return [id,{...stats(values),distinctRatings:new Set(values).size,range:Math.max(...values)-Math.min(...values),ratingChanges:values.slice(1).filter((v,i)=>v!==values[i]).length}];
 }));
 return {score:stats(runs.map(r=>r.score)),perCriterion,ratingChanges:Object.values(perCriterion).reduce((n,v)=>n+v.ratingChanges,0),method:"Population standard deviation across exactly five validated non-fallback runs; rating changes count adjacent runs. Human calibration validity requires independent references."};
}
