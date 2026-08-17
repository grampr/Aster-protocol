import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const gatewayRoot = join(repositoryRoot, "protocol", "gateway");

async function findSchemaFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findSchemaFiles(path)));
    } else if (entry.name.endsWith(".schema.json")) {
      files.push(path);
    }
  }

  return files.sort();
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const schemaFiles = await findSchemaFiles(gatewayRoot);
const schemas = await Promise.all(
  schemaFiles.map(async (path) => JSON.parse(await readFile(path, "utf8"))),
);

for (const schema of schemas) {
  ajv.addSchema(schema);
}

const rootSchemaId = "https://schemas.aster.dev/gateway/v1/gateway.schema.json";
const validate = ajv.getSchema(rootSchemaId);

if (!validate) {
  throw new Error(`Gateway root schema was not registered: ${rootSchemaId}`);
}

const validFixtures = [
  { op: 10, d: { heartbeat_interval_ms: 45_000 } },
  { op: 1, d: null },
  { op: 11, d: null },
  { op: 2, d: { token: "example-token", intents: 0 } },
  {
    op: 0,
    t: "READY",
    s: 0,
    d: {
      session_id: "0198b8f0-2d6e-7c45-9a3f-92e3f2f3c1a0",
      resume_gateway_url: "wss://instance.example/gateway/v1",
    },
  },
];

for (const fixture of validFixtures) {
  if (!validate(fixture)) {
    throw new Error(
      `Valid Gateway fixture was rejected:\n${JSON.stringify(validate.errors, null, 2)}`,
    );
  }
}

const invalidFixture = { op: 10, d: { heartbeat_interval_ms: 500 } };
if (validate(invalidFixture)) {
  throw new Error("Invalid Gateway fixture was accepted");
}

console.log(`Validated ${schemaFiles.length} Gateway schemas and fixtures.`);
