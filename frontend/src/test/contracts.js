import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Shared frontend <-> backend fixtures in /contracts (see backend/tests/contract/test_frontend_contract.py).
//   responses/*.json  written by the backend from its real view functions; read here.
//   requests/*.json   written here from the real adapter + api.js; validated by the backend's Pydantic shapes.
// After a deliberate request-shape change: UPDATE_CONTRACTS=1 npm test, then run the backend contract test.

const ROOT = fileURLToPath(new URL('../../../contracts/', import.meta.url));
const UPDATE = process.env.UPDATE_CONTRACTS === '1';

export const response = (name) => JSON.parse(readFileSync(`${ROOT}responses/${name}`, 'utf8'));

// Returns [actual, expected] for a toEqual assertion; in update mode, writes the file first.
export function requestFixture(name, body) {
  const path = `${ROOT}requests/${name}`;
  const actual = JSON.parse(JSON.stringify(body));
  if (UPDATE) writeFileSync(path, `${JSON.stringify(actual, null, 2)}\n`, 'utf8');
  return [actual, JSON.parse(readFileSync(path, 'utf8'))];
}
