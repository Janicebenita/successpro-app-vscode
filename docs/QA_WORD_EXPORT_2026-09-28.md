# Word export correction

Default and reordered resumes now use the same section renderer. Default exports no longer omit professional links. Project and publication URLs, certification URLs and recognition descriptions are retained. Section spacing and line height were increased; headings use keep-next and keep-lines controls, and body paragraphs enable widow control. Cover-letter closing and signature stay together.

Visual inspection found trimmed spaces between separately formatted runs and an unspecified recognition type being labelled Achievement. Both defects were corrected; PDF recognition labels also now leave an unspecified type unspecified.

Evidence: five focused Word-export tests pass. Eight synthetic fixtures rendered successfully through the bundled LibreOffice renderer. Clarity resume pages and Signature recognition/letter pages were inspected; revised run spacing is visible. This is not full visual acceptance: the remaining pages, font fidelity, optional photograph support and distinct layout parity with the four PDF themes still require work. These local changes are not included in the previously submitted cloud build and are not live.

Deployment recovery: the official Cloud SDK archive downloaded successfully with approved network access. Extraction was still running at the initial CLI check; that premature check cannot establish a broken installation. Recheck the existing extraction process before using the CLI. No duplicate cloud build was started.

Font verification: inspection of the actual PDF font resources from the eight Word renders found FrankRuhlHofshi and LinuxLibertine substitutions in Clarity, Momentum and Signature. Editorial retained NotoSans. This confirms that a valid font name in styles.xml is not enough to guarantee customer-visible theme fidelity. Resolve font portability (with licensed embedding or an explicitly supported fallback strategy) and repeat rendered checks before accepting Word/PDF design parity. The current Word exports must not be described as fully theme-matched.

CLI recovery subsequently completed and the executable starts successfully. A single Google authorization session is waiting for user verification. Browser sign-in alone does not authorize the CLI. Preserve that session rather than starting repeated login flows.
