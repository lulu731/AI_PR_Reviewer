## Brief overview
Guidelines for documenting session reports and validationresults. This rule ensures important reports generated during development are preserved in the project's session notes when requested.

## Report Saving Workflow
- After producing a report (validation results, generation summary, sync results, batch validation, etc.), ask the user if the report should be saved in `docs/session-notes.md`
- If the user approves, save the report to `docs/session-notes.md` with appropriate formatting:
  - Add a new section with date/time header (format: `## Title (Completed: YYYY-MM-DD HH:MM)`)
  - Include trigger information (command used, scope, date)
  - Document all validation results with emoji indicators (✅ Pass, ❌ Fail, ⚠️ Warning)
  - List all files created/modified with brief descriptions
  - Use markdown formatting consistent with existing session notes structure
- Use the existing `docs/session-notes.md` format as a template for consistency