import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const gatewayRoot = join(repositoryRoot, "protocol", "gateway", "common");
const outputPath = join(
  repositoryRoot,
  "packages",
  "protocol-ts",
  "src",
  "generated",
  "gateway-constants.ts",
);

async function readSchema(filename) {
  return JSON.parse(await readFile(join(gatewayRoot, filename), "utf8"));
}

function readIntegerDefinitions(schema, schemaName) {
  if (!schema.$defs || typeof schema.$defs !== "object") {
    throw new Error(`${schemaName} does not define $defs`);
  }

  return Object.entries(schema.$defs).map(([name, definition]) => {
    if (!Number.isInteger(definition.const)) {
      throw new Error(`${schemaName}.${name} must define an integer const`);
    }

    return [name, definition.const];
  });
}

function readStringDefinitions(schema, schemaName) {
  if (!schema.$defs || typeof schema.$defs !== "object") {
    throw new Error(`${schemaName} does not define $defs`);
  }

  return Object.entries(schema.$defs).map(([name, definition]) => {
    if (typeof definition.const !== "string" || definition.const.length === 0) {
      throw new Error(`${schemaName}.${name} must define a non-empty string const`);
    }

    return [name, JSON.stringify(definition.const)];
  });
}

function renderConstant(name, entries) {
  const properties = entries
    .map(([key, value]) => `  ${key}: ${value},`)
    .join("\n");

  return [
    `export const ${name} = Object.freeze({`,
    properties,
    "} as const);",
    "",
    `export type ${name}Value = (typeof ${name})[keyof typeof ${name}];`,
  ].join("\n");
}

const opcodeSchema = await readSchema("opcode.schema.json");
const intentsSchema = await readSchema("intents.schema.json");
const eventNameSchema = await readSchema("event-name.schema.json");

const output = [
  "// This file was generated from the Gateway JSON Schemas.",
  "// Do not edit it directly.",
  "",
  renderConstant(
    "GatewayOpcode",
    readIntegerDefinitions(opcodeSchema, "GatewayOpcode"),
  ),
  "",
  renderConstant(
    "GatewayIntent",
    readIntegerDefinitions(intentsSchema, "GatewayIntents"),
  ),
  "",
  renderConstant(
    "GatewayEvent",
    readStringDefinitions(eventNameSchema, "GatewayEventName"),
  ),
  "",
].join("\n");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, "utf8");

console.log(`Generated ${outputPath}`);
