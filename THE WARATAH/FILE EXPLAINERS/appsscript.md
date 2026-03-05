# appsscript.json

**Location:** `THE WARATAH/SHIFT REPORT SCRIPTS/appsscript.json`
**Type:** Project manifest (required by Google Apps Script)
**Edited:** Rarely — only when adding new API scopes or changing runtime settings

---

## What This File Does

This is the Google Apps Script project manifest. Every GAS project has exactly one `appsscript.json` file. It tells Google how to run your scripts.

---

## Current Configuration

```json
{
  "timeZone": "Australia/Sydney",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "dependencies": {}
}
```

| Setting | Value | What It Means |
|---------|-------|---------------|
| `timeZone` | `Australia/Sydney` | All date/time operations default to AEST/AEDT. Triggers fire on Sydney time. |
| `exceptionLogging` | `STACKDRIVER` | Unhandled errors are logged to Google Cloud's Stackdriver (now called Cloud Logging). |
| `runtimeVersion` | `V8` | Uses the modern V8 JavaScript engine (supports `let`, `const`, arrow functions, template literals, etc.). The alternative (`DEPRECATED_ES5`) is legacy. |
| `dependencies` | `{}` | No external GAS libraries are used. All code (including Slack Block Kit functions) is inlined in the project. |

---

## When Would You Need This File?

- **Adding an API scope** — If a new script needs access to a Google service (e.g., Calendar, Drive) that isn't auto-detected, you add an `oauthScopes` array here
- **Adding a library** — If you wanted to use an external GAS library (e.g., OAuth2), you'd add it to `dependencies`
- **Changing timezone** — If the venue moved to a different timezone (unlikely)

---

## Important Notes

- **Do not delete this file.** Without it, the Apps Script project won't function.
- Google auto-detects most OAuth scopes from your code. You only need to declare them explicitly here if auto-detection misses one or if you want to restrict scopes.
- The `V8` runtime is required for all modern JavaScript syntax used throughout the project. Do not change this to `DEPRECATED_ES5`.
