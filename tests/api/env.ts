import { readFileSync } from "fs"
import path from "path"

// Load .env for DATABASE_URL (tests talk to the same DB as the server)
try {
  for (const line of readFileSync(path.join(process.cwd(), ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
  }
} catch {}
