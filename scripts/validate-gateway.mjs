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

function findSchema(title) {
  const schema = schemas.find((candidate) => candidate.title === title);
  if (!schema) {
    throw new Error(`Gateway schema was not found: ${title}`);
  }

  return schema;
}

function readIntegerDefinitions(schema) {
  if (!schema.$defs || typeof schema.$defs !== "object") {
    throw new Error(`${schema.title} does not define $defs`);
  }

  return Object.entries(schema.$defs).map(([name, definition]) => {
    if (!Number.isInteger(definition.const)) {
      throw new Error(`${schema.title}.${name} must define an integer const`);
    }

    return [name, definition.const];
  });
}

function readStringDefinitions(schema) {
  if (!schema.$defs || typeof schema.$defs !== "object") {
    throw new Error(`${schema.title} does not define $defs`);
  }

  return Object.entries(schema.$defs).map(([name, definition]) => {
    if (typeof definition.const !== "string" || definition.const.length === 0) {
      throw new Error(`${schema.title}.${name} must define a non-empty string const`);
    }

    return [name, definition.const];
  });
}

function assertUniqueValues(entries, schemaName) {
  const values = entries.map(([, value]) => value);
  if (new Set(values).size !== values.length) {
    throw new Error(`${schemaName} contains duplicate values`);
  }
}

const opcodeDefinitions = readIntegerDefinitions(findSchema("GatewayOpcode"));
assertUniqueValues(opcodeDefinitions, "GatewayOpcode");

const intentDefinitions = readIntegerDefinitions(findSchema("GatewayIntents"));
assertUniqueValues(intentDefinitions, "GatewayIntents");

const eventDefinitions = readStringDefinitions(findSchema("GatewayEventName"));
assertUniqueValues(eventDefinitions, "GatewayEventName");

for (const [name, value] of intentDefinitions) {
  if (value <= 0 || (value & (value - 1)) !== 0) {
    throw new Error(`GatewayIntents.${name} must contain exactly one bit`);
  }
}

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
  { op: 2, d: { token: "example-token", intents: 5 } },
  {
    op: 0,
    t: "READY",
    s: 0,
    d: {
      session_id: "0198b8f0-2d6e-7c45-9a3f-92e3f2f3c1a0",
      resume_gateway_url: "wss://instance.example/gateway/v1",
    },
  },
  {
    op: 0,
    t: "MESSAGE_CREATE",
    s: 1,
    d: {
      id: "0198b8f2-4f80-7e67-b250-b4051415e3c2",
      channel_id: "0198b8f1-3e7f-7d56-a14f-a3f40304d2b1",
      author: {
        id: "0198b8ef-1c5d-7b34-892e-81d2e1e2b090",
        display_name: "Alice",
        avatar_url: "https://cdn.example.com/avatars/alice.png",
      },
      content: "10月24日で進める方向でよいでしょうか？",
      reply_to_message_id: "0198b8f0-1b72-73a2-a2ef-75cf3cd276d8",
      reply_to: {
        id: "0198b8f0-1b72-73a2-a2ef-75cf3cd276d8",
        channel_id: "0198b8f1-3e7f-7d56-a14f-a3f40304d2b1",
        author: {
          id: "0198b8ed-7ba1-7165-b028-9ecf14ed1e7b",
          display_name: "Bob",
          avatar_url: null,
        },
        content: "10月24日で進めませんか？",
        created_at: "2026-08-17T06:10:00Z",
        edited_at: null,
      },
      created_at: "2026-08-17T06:12:00Z",
      edited_at: null,
    },
  },
  {
    op: 0,
    t: "MESSAGE_UPDATE",
    s: 2,
    d: {
      id: "0198b8f2-4f80-7e67-b250-b4051415e3c2",
      channel_id: "0198b8f1-3e7f-7d56-a14f-a3f40304d2b1",
      author: {
        id: "0198b8ef-1c5d-7b34-892e-81d2e1e2b090",
        display_name: "Alice",
        avatar_url: null,
      },
      content: null,
      reply_to_message_id: null,
      reply_to: null,
      created_at: "2026-08-17T06:12:00Z",
      edited_at: "2026-08-17T06:15:00Z",
    },
  },
  {
    op: 0,
    t: "MESSAGE_DELETE",
    s: 3,
    d: {
      id: "0198b8f2-4f80-7e67-b250-b4051415e3c2",
      channel_id: "0198b8f1-3e7f-7d56-a14f-a3f40304d2b1",
    },
  },
  {
    op: 0,
    t: "TYPING_START",
    s: 4,
    d: {
      channel_id: "0198b8f1-3e7f-7d56-a14f-a3f40304d2b1",
      user: {
        id: "0198b8ef-1c5d-7b34-892e-81d2e1e2b090",
        display_name: "Alice",
        avatar_url: null,
      },
      started_at: "2026-08-17T06:16:00Z",
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

const invalidIntentFixture = {
  op: 2,
  d: { token: "example-token", intents: -1 },
};
if (validate(invalidIntentFixture)) {
  throw new Error("Negative Gateway intents were accepted");
}

const invalidDispatchFixture = {
  op: 0,
  t: "MESSAGE_DELETE",
  d: {
    id: "0198b8f2-4f80-7e67-b250-b4051415e3c2",
    channel_id: "0198b8f1-3e7f-7d56-a14f-a3f40304d2b1",
  },
};
if (validate(invalidDispatchFixture)) {
  throw new Error("Dispatch Event without a sequence was accepted");
}

console.log(
  `Validated ${schemaFiles.length} Gateway schemas, ${opcodeDefinitions.length} opcodes, ${intentDefinitions.length} intents, ${eventDefinitions.length} events, and fixtures.`,
);
