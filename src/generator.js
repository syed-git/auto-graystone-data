import { ValidationError } from './errors.js';
import { normalizeDate, parseDate, startOfDay, toGraystoneDate } from './dates.js';
import {
  DEFAULT_COVERAGES,
  DEFAULT_RELATIONSHIP,
  GENDER_OPTIONS,
  GROUPS,
  MAX_ENTRIES,
  OPTIONAL_DRIVER_FIELDS,
  OPTIONAL_INSURED_FIELDS,
  OPTIONAL_VEHICLE_FIELDS,
  OWNERSHIP_OPTIONS,
  RELATIONSHIP_OPTIONS,
  USAGE_OPTIONS,
  VIN_PATTERN,
} from './options.js';
import { random } from './random.js';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/**
 * Builds a complete AutoGraystone data set from a partial request body.
 *
 *   - values supplied in `input` always win (after normalisation: dates -> MM-DD-YYYY,
 *     option lists -> exact label, numbers/booleans -> strings)
 *   - missing mandatory values get random-but-valid values
 *   - optional values are only present when supplied
 *   - invalid values raise a ValidationError listing every problem found
 *
 * `now` is injectable so the tests can pin "today".
 */
export function buildAutoGraystoneData(input = {}, { now = new Date() } = {}) {
  if (input === undefined || input === null) input = {};
  if (!isPlainObject(input)) {
    throw new ValidationError({ path: '$', message: 'Request body must be a JSON object' });
  }

  const errors = [];
  const fail = (path, message) => errors.push({ path, message });
  const ctx = { now, fail };

  const effectiveDate = readDate(input.effectiveDate, 'effectiveDate', ctx) ?? toGraystoneDate(now);

  const groups = {};
  const counts = {};
  for (const [groupKey, { countKey, prefix }] of Object.entries(GROUPS)) {
    const provided = readGroup(input[groupKey], groupKey, prefix, ctx);
    counts[countKey] = readCount(input[countKey], countKey, groupKey, provided, ctx);
    groups[groupKey] = provided;
  }

  const coverages = readCoverages(input.Coverages, ctx);
  const cancellation = readCancellation(input.Cancellation, ctx);

  const numberOfDrivers = counts.numberOfDrivers;
  const insured = expandGroup(groups.Insured, 'NamedInsured', counts.numberOfInsured, (entry, index, path) =>
    buildInsured(entry, index, path, ctx),
  );
  const drivers = expandGroup(groups.Drivers, 'Driver', numberOfDrivers, (entry, index, path) => buildDriver(entry, path, ctx));
  const vehicles = expandGroup(groups.Vehicles, 'Vehicle', counts.numberOfVehicles, (entry, index, path) =>
    buildVehicle(entry, path, { ...ctx, numberOfDrivers }),
  );

  if (errors.length) throw new ValidationError(errors);

  ensureUniqueNames(insured, groups.Insured);
  ensureUniqueNames(drivers, groups.Drivers);

  const data = {
    effectiveDate,
    numberOfInsured: String(counts.numberOfInsured),
    numberOfDrivers: String(numberOfDrivers),
    numberOfVehicles: String(counts.numberOfVehicles),
    Insured: insured,
    Drivers: drivers,
    Vehicles: vehicles,
    Coverages: coverages,
  };
  if (cancellation !== undefined) data.Cancellation = cancellation;

  const known = new Set(['effectiveDate', 'Insured', 'Drivers', 'Vehicles', 'Coverages', 'Cancellation', ...Object.values(GROUPS).map((g) => g.countKey)]);
  for (const [key, value] of Object.entries(input)) {
    if (!known.has(key) && value !== undefined) data[key] = clone(value);
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Field readers - return the normalised value or undefined            */
/* ------------------------------------------------------------------ */

/** Strings are trimmed, numbers and booleans become strings, blanks become undefined. */
function readScalar(value, path, { fail }) {
  if (isBlank(value)) return undefined;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  fail(path, 'must be a string, number or boolean');
  return undefined;
}

function readDate(value, path, ctx) {
  const raw = readScalar(value, path, ctx);
  if (raw === undefined) return undefined;
  const normalized = normalizeDate(raw);
  if (!normalized) ctx.fail(path, `"${raw}" is not a valid date; use MM-DD-YYYY`);
  return normalized ?? undefined;
}

function readDateOfBirth(value, path, ctx) {
  const normalized = readDate(value, path, ctx);
  if (normalized && parseDate(normalized) > startOfDay(ctx.now)) {
    ctx.fail(path, `"${normalized}" is in the future`);
    return undefined;
  }
  return normalized;
}

/** Case-insensitive / prefix match against an option list ("owned" -> "Owned"). */
function readOption(value, path, options, ctx) {
  const raw = readScalar(value, path, ctx);
  if (raw === undefined) return undefined;
  const lower = raw.toLowerCase();
  const match =
    options.find((o) => o === raw) ||
    options.find((o) => o.toLowerCase() === lower) ||
    options.find((o) => o.toLowerCase().startsWith(lower));
  if (!match) ctx.fail(path, `"${raw}" is not one of ${options.join(', ')}`);
  return match;
}

function readInteger(value, path, ctx, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = readScalar(value, path, ctx);
  if (raw === undefined) return undefined;
  if (!/^-?\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    ctx.fail(path, `"${raw}" must be a whole number between ${min} and ${max}`);
    return undefined;
  }
  return String(Number(raw));
}

function readCount(value, countKey, groupKey, provided, ctx) {
  const supplied = Object.keys(provided).length;
  const highest = Math.max(0, ...Object.values(provided).map((e) => e.index));
  if (isBlank(value)) return Math.max(highest, 1);

  const count = readInteger(value, countKey, ctx, { min: 1, max: MAX_ENTRIES });
  if (count === undefined) return Math.max(highest, 1);
  if (Number(count) < highest) {
    ctx.fail(countKey, `is ${count} but ${groupKey} contains ${supplied} entr${supplied === 1 ? 'y' : 'ies'} up to ${GROUPS[groupKey].prefix}${highest}`);
  }
  return Number(count);
}

/** Returns `{ [key]: { index, entry } }` for every valid entry of a group. */
function readGroup(value, groupKey, prefix, ctx) {
  const entries = {};
  if (isBlank(value)) return entries;
  if (!isPlainObject(value)) {
    ctx.fail(groupKey, `must be an object with ${prefix}1, ${prefix}2, ... keys`);
    return entries;
  }
  const keyPattern = new RegExp(`^${prefix}([1-9]\\d*)$`);
  for (const [key, entry] of Object.entries(value)) {
    const path = `${groupKey}.${key}`;
    const match = key.match(keyPattern);
    if (!match) {
      ctx.fail(path, `unexpected key; use ${prefix}1, ${prefix}2, ...`);
      continue;
    }
    if (Number(match[1]) > MAX_ENTRIES) {
      ctx.fail(path, `index exceeds the maximum of ${MAX_ENTRIES}`);
      continue;
    }
    if (entry === undefined || entry === null) continue;
    if (!isPlainObject(entry)) {
      ctx.fail(path, 'must be an object');
      continue;
    }
    entries[key] = { index: Number(match[1]), entry };
  }
  return entries;
}

function readCoverages(value, ctx) {
  const coverages = { ...DEFAULT_COVERAGES };
  if (isBlank(value)) return coverages;
  if (!isPlainObject(value)) {
    ctx.fail('Coverages', 'must be an object');
    return coverages;
  }
  for (const [key, raw] of Object.entries(value)) {
    const normalized = readScalar(raw, `Coverages.${key}`, ctx);
    if (normalized !== undefined) coverages[key] = normalized;
  }
  return coverages;
}

/** Returned exactly as supplied. */
function readCancellation(value, ctx) {
  if (value === undefined || value === null) return undefined;
  if (!isPlainObject(value)) {
    ctx.fail('Cancellation', 'must be an object');
    return undefined;
  }
  return clone(value);
}

/* ------------------------------------------------------------------ */
/* Entity builders                                                      */
/* ------------------------------------------------------------------ */

function expandGroup(provided, prefix, count, build) {
  const group = {};
  for (let i = 1; i <= count; i++) {
    const key = `${prefix}${i}`;
    group[key] = build(provided[key]?.entry ?? {}, i, key);
  }
  return group;
}

/** Copies the keys of `entry` that this API does not know about, untouched. */
function passThroughUnknown(entry, knownKeys, target) {
  for (const [key, value] of Object.entries(entry)) {
    if (!knownKeys.has(key) && value !== undefined) target[key] = clone(value);
  }
  return target;
}

function addOptional(entry, fields, path, target, ctx) {
  for (const key of fields) {
    const value = readScalar(entry[key], `${path}.${key}`, ctx);
    if (value !== undefined) target[key] = value;
  }
}

function buildPerson(entry, path, ctx) {
  return {
    firstName: readScalar(entry.firstName, `${path}.firstName`, ctx) ?? random.firstName(),
    lastName: readScalar(entry.lastName, `${path}.lastName`, ctx) ?? random.lastName(),
    dateOfBirth: readDateOfBirth(entry.dateOfBirth, `${path}.dateOfBirth`, ctx) ?? random.dateOfBirth(ctx.now),
    gender: readOption(entry.gender, `${path}.gender`, GENDER_OPTIONS, ctx) ?? random.gender(),
  };
}

/** `isPrimaryInsured` is true for NamedInsured1 only, whatever the request says. */
function buildInsured(entry, index, path, ctx) {
  const fullPath = `Insured.${path}`;
  const insured = { ...buildPerson(entry, fullPath, ctx), isPrimaryInsured: String(index === 1) };
  addOptional(entry, OPTIONAL_INSURED_FIELDS, fullPath, insured, ctx);
  return passThroughUnknown(entry, new Set([...Object.keys(insured), ...OPTIONAL_INSURED_FIELDS]), insured);
}

function buildDriver(entry, path, ctx) {
  const fullPath = `Drivers.${path}`;
  const driver = {
    ...buildPerson(entry, fullPath, ctx),
    licenseNumber: readScalar(entry.licenseNumber, `${fullPath}.licenseNumber`, ctx) ?? random.licenseNumber(),
  };
  addOptional(entry, ['licenseState'], fullPath, driver, ctx);
  for (const key of ['yearsLicensed', 'accidents', 'violations']) {
    const value = readInteger(entry[key], `${fullPath}.${key}`, ctx);
    if (value !== undefined) driver[key] = value;
  }
  driver.relationshipToInsured =
    readOption(entry.relationshipToInsured, `${fullPath}.relationshipToInsured`, RELATIONSHIP_OPTIONS, ctx) ?? DEFAULT_RELATIONSHIP;
  return passThroughUnknown(entry, new Set([...Object.keys(driver), ...OPTIONAL_DRIVER_FIELDS]), driver);
}

function buildVehicle(entry, path, ctx) {
  const fullPath = `Vehicles.${path}`;
  const [randomMake, randomModel] = random.makeModel();
  const make = readScalar(entry.make, `${fullPath}.make`, ctx) ?? randomMake;
  const model = readScalar(entry.model, `${fullPath}.model`, ctx) ?? randomModel;

  const vehicle = {
    year: readInteger(entry.year, `${fullPath}.year`, ctx, { min: 1900, max: ctx.now.getFullYear() + 1 }) ?? random.year(ctx.now),
    make,
    model,
    vin: readVin(entry.vin, `${fullPath}.vin`, ctx) ?? random.vin(),
    ownership: readOption(entry.ownership, `${fullPath}.ownership`, OWNERSHIP_OPTIONS, ctx) ?? random.ownership(),
  };

  const usage = readOption(entry.usage, `${fullPath}.usage`, USAGE_OPTIONS, ctx);
  if (usage !== undefined) vehicle.usage = usage;
  for (const key of ['annualMileage', 'costNew']) {
    const value = readInteger(entry[key], `${fullPath}.${key}`, ctx);
    if (value !== undefined) vehicle[key] = value;
  }
  const primaryDriver = readInteger(entry.primaryDriver, `${fullPath}.primaryDriver`, ctx, { min: 1, max: ctx.numberOfDrivers });
  if (primaryDriver !== undefined) vehicle.primaryDriver = primaryDriver;

  return passThroughUnknown(entry, new Set([...Object.keys(vehicle), ...OPTIONAL_VEHICLE_FIELDS]), vehicle);
}

/** Upper-cased "VIN" + alphanumerics (15-17 characters). */
function readVin(value, path, ctx) {
  const raw = readScalar(value, path, ctx);
  if (raw === undefined) return undefined;
  const vin = raw.toUpperCase();
  if (!VIN_PATTERN.test(vin)) {
    ctx.fail(path, `"${raw}" must be 15-17 alphanumeric characters starting with VIN`);
    return undefined;
  }
  return vin;
}

/** Generated people must not share a full name (supplied names are left alone). */
function ensureUniqueNames(group, provided) {
  const seen = new Set();
  for (const [key, person] of Object.entries(group)) {
    const supplied = provided[key]?.entry ?? {};
    const firstFixed = !isBlank(supplied.firstName);
    const lastFixed = !isBlank(supplied.lastName);
    let fullName = `${person.firstName} ${person.lastName}`;
    let attempts = 0;
    while (seen.has(fullName) && attempts < 50 && !(firstFixed && lastFixed)) {
      if (!firstFixed) person.firstName = random.firstName();
      if (!lastFixed) person.lastName = random.lastName();
      fullName = `${person.firstName} ${person.lastName}`;
      attempts++;
    }
    seen.add(fullName);
  }
}
