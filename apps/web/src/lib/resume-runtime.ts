import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";
export const INTEGRATION_VERSION="successpro-integration-phase3-v1";
export async function resumeRuntime(){
 const root=path.resolve(process.cwd(),"../..");
 const paths=["apps/web/src/app/api/reviews/route.ts","apps/web/src/lib/successpro-v2-review.ts","packages/contracts/src/index.ts"];
 const modules=await Promise.all(paths.map(async file=>({path:path.join(root,file),sha256:createHash("sha256").update(await readFile(path.join(root,file))).digest("hex")})));
 return {integrationVersion:INTEGRATION_VERSION,pid:process.pid,node:process.version,executable:process.execPath,cwd:process.cwd(),modules};
}

export async function processingRevision(){
 const dir=path.resolve(process.cwd(),"../../processing/resume_worker");
 const names=["ai.py","extraction.py","models.py","runtime_identity.py","structured.py","visual.py","worker.py","workbook_visual_rubric.json"];
 const hashes=await Promise.all(names.sort().map(async name=>name+":"+createHash("sha256").update(await readFile(path.join(dir,name))).digest("hex")+"\n"));
 return createHash("sha256").update(hashes.join("")).digest("hex");
}
