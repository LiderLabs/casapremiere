// Small helpers for the local admin CLI scripts. Windows-friendly, no dependencies.

import { existsSync, readFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

/** `--username casa --role admin --no-force-change` → { username: "casa", role: "admin", "no-force-change": true } */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const args: Record<string, string | true> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const [key, inlineValue] = token.slice(2).split("=");
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

export function stringArg(
  args: Record<string, string | true>,
  key: string,
): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Loads a .env file into process.env.
 *
 * Next loads `.env.local` for `next dev` / `next build`; plain `tsx` does not, so the CLI
 * scripts would otherwise only ever see the development defaults. Values already present in
 * the environment win, which is what makes a one-off run against another database possible:
 *
 *   $env:TURSO_DATABASE_URL="file:./.local/cms.db"; npm run cms:migrate
 *
 * Missing files are not an error: `.env.local` is optional, and `.env.turso.local` does not
 * exist for anyone who has not been given the production credentials.
 */
export function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;

  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;

    const value = line.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    process.env[key] = quoted ? value.slice(1, -1) : value;
  }
}

/**
 * The database a CLI run will talk to.
 *
 * Default: the local file in .env.local, or the development default (`file:./.local/cms.db`)
 * when nothing is configured at all - so day-to-day work never touches production. `--turso`
 * reads .env.turso.local instead and reaches the real database, which is how the schema is
 * migrated and how the first admin is created.
 */
export function loadDatabaseEnv(args: Record<string, string | true>): void {
  loadEnvFile(".env.local");

  if (args.turso) {
    loadEnvFile(".env.turso.local");

    if (process.env.TURSO_DATABASE_URL && !process.env.TURSO_DATABASE_URL.startsWith("file:")) {
      const token = process.env.TURSO_AUTH_TOKEN;
      if (!token) throw new Error("--turso needs TURSO_AUTH_TOKEN in .env.turso.local.");
      return;
    }

    throw new Error(
      "--turso needs TURSO_DATABASE_URL in .env.turso.local (a libsql:// URL), or set it in the environment.",
    );
  }
}

/** `[cms] database: …` — printed before every write so nobody has to guess where it landed. */
export function databaseLabel(url: string): string {
  return url.startsWith("file:") ? `local SQLite file (${url})` : `Turso (${url})`;
}

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/**
 * Reads a line without echoing it, so a password is not left in the terminal scrollback.
 * ASCII only (a backspace removes one character); pass `--password` to skip the prompt
 * entirely when running non-interactively.
 */
/** `process.stdin` only has raw-mode methods when it is an actual TTY, so they are optional here. */
type RawCapableStdin = typeof stdin & {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode?: (mode: boolean) => void;
};

export async function askHidden(question: string): Promise<string> {
  const rawStdin = stdin as RawCapableStdin;
  if (!rawStdin.isTTY) return ask(question); // piped input cannot be hidden

  return new Promise<string>((resolve, reject) => {
    const characters: string[] = [];
    const wasRaw = rawStdin.isRaw;

    stdout.write(question);
    rawStdin.setRawMode?.(true);
    stdin.resume();

    const finish = (error?: Error) => {
      stdin.removeListener("data", onData);
      rawStdin.setRawMode?.(wasRaw ?? false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(characters.join(""));
    };

    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0003") return finish(new Error("Cancelled"));
        if (character === "\u007f" || character === "\b") {
          characters.pop();
          continue;
        }
        characters.push(character);
      }
    };

    stdin.on("data", onData);
  });
}
