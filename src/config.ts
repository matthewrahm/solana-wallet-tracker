import { readFileSync } from "fs";
import { parse } from "yaml";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Config {
  allowed_users: number[];
}

const configPath = join(__dirname, "..", "config.yaml");
const raw = readFileSync(configPath, "utf-8");
const parsed = parse(raw);

export const config: Config = {
  allowed_users: parsed.allowed_users ?? [],
};
