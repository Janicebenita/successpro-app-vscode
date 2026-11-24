// Legacy criteria can route evidence but cannot supply a full workbook rating.
export const LEGACY_VISUAL_EVIDENCE_OWNERS:Record<string,readonly string[]>={visual_hierarchy:["V01"],typography:["V02"],whitespace_margins:["V03"],alignment_reading_order:["V01","V03"],cross_page_consistency:["V04","V05"],scannability:["V01","V03"]};
export function visualCodeMapping(code:string){if(/^V0[1-6]$/.test(code))return {owners:[code],requiresReassessment:false};const owners=LEGACY_VISUAL_EVIDENCE_OWNERS[code];return {owners:owners ?? [],requiresReassessment:true};}
