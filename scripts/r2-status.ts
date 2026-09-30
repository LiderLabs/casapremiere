// What is in the image bucket right now. Read-only, so it is safe to point at production —
// the counterpart to `npm run cms:status` for R2 (docs/cms-build-spec.md §8).
//
//   npm run cms:r2                     list every object
//   npm run cms:r2 -- --orphans        list objects no property_media row points at
//
// It imports the R2 client and the database, so it needs the R2_* values in .env.local.

import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

import { getDb, getDbClient } from "../lib/cms/db";
import { getEnv, isR2Configured } from "../lib/cms/env";
import { propertyMedia } from "../lib/cms/schema";
import { loadEnvFile, parseArgs } from "./cli-utils";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Next loads .env.local for the app; a script run through tsx has no loader of its own.
  loadEnvFile(".env.local");

  const env = getEnv();

  if (!isR2Configured(env)) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET in .env.local.",
    );
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
    },
  });

  console.log(`[r2] bucket: ${env.R2_BUCKET}`);
  console.log(
    `[r2] public base: ${env.R2_PUBLIC_BASE_URL ?? "(unset - reads proxy through /api/media; set this to serve direct)"}`,
  );

  try {
    const listed = await client.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET }));
    const objects = (listed.Contents ?? []).map((object) => object.Key ?? "").filter(Boolean);

    console.log(`[r2] objects: ${objects.length}`);

    const db = getDb();
    const rows = await db.select({ r2Key: propertyMedia.r2Key }).from(propertyMedia);
    const referenced = new Set(rows.map((row) => row.r2Key));

    const orphans = objects.filter((key) => !referenced.has(key));
    const missing = [...referenced].filter(
      (key) => !key.startsWith("/") && !objects.includes(key),
    );

    if (args.orphans) {
      for (const key of orphans) console.log(`[r2]   orphan: ${key}`);
    } else {
      for (const key of objects) {
        console.log(`[r2]   ${referenced.has(key) ? "used  " : "orphan"} ${key}`);
      }
    }

    console.log(`[r2] orphans: ${orphans.length} · rows with no object: ${missing.length}`);
    for (const key of missing) console.log(`[r2]   missing: ${key}`);
  } finally {
    getDbClient().close();
  }
}

main().catch((error) => {
  console.error(`[r2] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
