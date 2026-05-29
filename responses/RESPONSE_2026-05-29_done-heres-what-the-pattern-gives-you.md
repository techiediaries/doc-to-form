Done. Here's what the pattern gives you:

**The key protection:** [spec/field-spec.v1.json](../antigravityapps/doc-to-form/spec/field-spec.v1.json) is now the single source of truth for all detection rules and field rendering. `convert_docx.py` has zero hardcoded patterns.

**How upgrades work in practice:**

| Scenario | What you do | Old templates |
|---|---|---|
| Add a new field type (e.g. `signature`) | Add to `field_types` in v1 | Unaffected |
| Add a new detection rule at low priority | Add to `detection_rules` in v1 | Unaffected |
| Change how a date field renders | Edit `html_input` for `date` in v1 | Picks up the change |
| Reprioritize detection rules (breaking) | Create `field-spec.v2.json`, update new templates in manifest | Stay on v1 forever |

The [templates.manifest.json](../antigravityapps/doc-to-form/spec/templates.manifest.json) is where each template declares `"spec_version": "1"` — that pin is what makes old templates immune to future changes.