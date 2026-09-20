import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAutoGraystoneData } from '../src/generator.js';
import { ValidationError } from '../src/errors.js';
import {
  DEFAULT_COVERAGES,
  OPTIONAL_COVERAGES,
  OPTIONAL_DRIVER_FIELDS,
  OPTIONAL_INSURED_FIELDS,
  OPTIONAL_VEHICLE_FIELDS,
  OWNERSHIP_OPTIONS,
} from '../src/options.js';

const NOW = new Date(2026, 8, 20); // 09-20-2026
const build = (input) => buildAutoGraystoneData(input, { now: NOW });
const keysOf = (obj) => Object.keys(obj || {});

function expectErrors(input, ...paths) {
  try {
    build(input);
  } catch (err) {
    assert.ok(err instanceof ValidationError, `expected ValidationError, got ${err}`);
    for (const path of paths) {
      assert.ok(err.details.some((d) => d.path === path), `expected an error for "${path}" in ${JSON.stringify(err.details)}`);
    }
    return err.details;
  }
  assert.fail(`expected a ValidationError for ${JSON.stringify(input)}`);
}

test('no body -> effective today, one insured, one driver, one vehicle', () => {
  for (const input of [undefined, null, {}]) {
    const data = build(input);
    assert.equal(data.effectiveDate, '09-20-2026');
    assert.equal(data.numberOfInsured, '1');
    assert.equal(data.numberOfDrivers, '1');
    assert.equal(data.numberOfVehicles, '1');
    assert.deepEqual(keysOf(data.Insured), ['NamedInsured1']);
    assert.deepEqual(keysOf(data.Drivers), ['Driver1']);
    assert.deepEqual(keysOf(data.Vehicles), ['Vehicle1']);
    assert.equal('Cancellation' in data, false);
  }
});

test('mandatory fields are generated, optional fields are not', () => {
  const data = build({ numberOfInsured: '3', numberOfDrivers: '3', numberOfVehicles: '3' });

  for (const insured of Object.values(data.Insured)) {
    for (const key of ['firstName', 'lastName', 'dateOfBirth', 'gender', 'isPrimaryInsured']) assert.ok(insured[key], key);
    assert.match(insured.dateOfBirth, /^\d{2}-\d{2}-\d{4}$/);
    for (const key of OPTIONAL_INSURED_FIELDS) assert.equal(key in insured, false, `${key} must not be generated`);
  }
  for (const driver of Object.values(data.Drivers)) {
    for (const key of ['firstName', 'lastName', 'dateOfBirth', 'gender', 'licenseNumber']) assert.ok(driver[key], key);
    assert.match(driver.licenseNumber, /^\d{10}$/);
    assert.equal(driver.relationshipToInsured, 'Insured');
    for (const key of OPTIONAL_DRIVER_FIELDS) assert.equal(key in driver, false, `${key} must not be generated`);
  }
  for (const vehicle of Object.values(data.Vehicles)) {
    for (const key of ['year', 'make', 'model', 'vin']) assert.ok(vehicle[key], key);
    assert.match(vehicle.vin, /^VIN[A-Z0-9]{12}$/);
    assert.equal(vehicle.vin.length, 15);
    assert.ok(OWNERSHIP_OPTIONS.includes(vehicle.ownership), vehicle.ownership);
    for (const key of OPTIONAL_VEHICLE_FIELDS) assert.equal(key in vehicle, false, `${key} must not be generated`);
  }
  assert.deepEqual(data.Coverages, DEFAULT_COVERAGES);
  for (const key of OPTIONAL_COVERAGES) assert.equal(key in data.Coverages, false, `${key} must not be generated`);
});

test('generated people never share a full name', () => {
  for (let i = 0; i < 20; i++) {
    const data = build({ numberOfDrivers: '10', numberOfInsured: '10' });
    const names = Object.values(data.Drivers).map((d) => `${d.firstName} ${d.lastName}`);
    assert.equal(new Set(names).size, names.length);
  }
});

test('supplied values win and supplied optional fields are echoed', () => {
  const data = build({
    effectiveDate: '01-15-2030',
    Insured: {
      NamedInsured1: {
        firstName: 'Joe', lastName: 'Biden', dateOfBirth: '09-01-1989', gender: 'Male',
        email: 'joe.biden@example.com', phone: '2125550123', address: '227 Park Ave', city: 'New York', state: 'NY', zip: '10017',
      },
    },
    Drivers: {
      Driver1: {
        firstName: 'John', lastName: 'Wick', dateOfBirth: '09-01-1979', gender: 'Male', licenseNumber: '7494797412',
        licenseState: 'NY', yearsLicensed: '15', accidents: '0', violations: '0', relationshipToInsured: 'Insured',
      },
    },
    Vehicles: {
      Vehicle1: { year: '2020', make: 'Toyota', model: 'Camry', vin: 'VIN376683HJGDJSH', ownership: 'Owned', usage: 'Commute', annualMileage: '12000', costNew: '28999', primaryDriver: '1' },
    },
    Coverages: {
      bodilyInjuryLiability: '50k/100k', propertyDamageLiability: '50k', uninsuredMotorist: '50k/100k', medicalPayments: '1k',
      comprehensive: '$250 ded', collision: '$250 ded', rentalReimbursement: '$30/day', roadSideAssitance: 'true',
    },
    Cancellation: { type: 'Flat', effectiveDate: '', reason: 'Insured request' },
  });

  assert.deepEqual(data, {
    effectiveDate: '01-15-2030',
    numberOfInsured: '1',
    numberOfDrivers: '1',
    numberOfVehicles: '1',
    Insured: {
      NamedInsured1: {
        firstName: 'Joe', lastName: 'Biden', dateOfBirth: '09-01-1989', gender: 'Male', isPrimaryInsured: 'true',
        email: 'joe.biden@example.com', phone: '2125550123', address: '227 Park Ave', city: 'New York', state: 'NY', zip: '10017',
      },
    },
    Drivers: {
      Driver1: {
        firstName: 'John', lastName: 'Wick', dateOfBirth: '09-01-1979', gender: 'Male', licenseNumber: '7494797412',
        licenseState: 'NY', yearsLicensed: '15', accidents: '0', violations: '0', relationshipToInsured: 'Insured',
      },
    },
    Vehicles: {
      Vehicle1: { year: '2020', make: 'Toyota', model: 'Camry', vin: 'VIN376683HJGDJSH', ownership: 'Owned', usage: 'Commute', annualMileage: '12000', costNew: '28999', primaryDriver: '1' },
    },
    Coverages: {
      bodilyInjuryLiability: '50k/100k', propertyDamageLiability: '50k', collision: '$250 ded', uninsuredMotorist: '50k/100k',
      medicalPayments: '1k', comprehensive: '$250 ded', rentalReimbursement: '$30/day', roadSideAssitance: 'true',
    },
    Cancellation: { type: 'Flat', effectiveDate: '', reason: 'Insured request' },
  });
});

test('partially supplied optional fields: only the given ones are present', () => {
  const data = build({
    Insured: { NamedInsured1: { email: 'a@b.com' } },
    Drivers: { Driver1: { accidents: 3 } },
    Vehicles: { Vehicle1: { usage: 'pleasure' } },
    Coverages: { medicalPayments: '5k' },
  });
  assert.equal(data.Insured.NamedInsured1.email, 'a@b.com');
  for (const key of OPTIONAL_INSURED_FIELDS.filter((k) => k !== 'email')) assert.equal(key in data.Insured.NamedInsured1, false, key);
  assert.equal(data.Drivers.Driver1.accidents, '3');
  assert.equal('violations' in data.Drivers.Driver1, false);
  assert.equal(data.Vehicles.Vehicle1.usage, 'Pleasure');
  assert.equal('annualMileage' in data.Vehicles.Vehicle1, false);
  assert.deepEqual(data.Coverages, { ...DEFAULT_COVERAGES, medicalPayments: '5k' });
});

test('required coverages fall back to their defaults individually', () => {
  const data = build({ Coverages: { bodilyInjuryLiability: '100k/300k' } });
  assert.equal(data.Coverages.bodilyInjuryLiability, '100k/300k');
  assert.equal(data.Coverages.propertyDamageLiability, '50k');
  assert.equal(data.Coverages.collision, '$250 ded');
});

test('isPrimaryInsured is true for NamedInsured1 only, whatever the request says', () => {
  const data = build({
    numberOfInsured: '3',
    Insured: { NamedInsured1: { isPrimaryInsured: false }, NamedInsured2: { isPrimaryInsured: 'true' }, NamedInsured3: { isPrimaryInsured: true } },
  });
  assert.equal(data.Insured.NamedInsured1.isPrimaryInsured, 'true');
  assert.equal(data.Insured.NamedInsured2.isPrimaryInsured, 'false');
  assert.equal(data.Insured.NamedInsured3.isPrimaryInsured, 'false');
});

test('relationshipToInsured defaults to Insured and ownership is generated from the allowed list', () => {
  const data = build({ Drivers: { Driver1: { relationshipToInsured: '' } }, Vehicles: { Vehicle1: { ownership: null } } });
  assert.equal(data.Drivers.Driver1.relationshipToInsured, 'Insured');
  assert.ok(OWNERSHIP_OPTIONS.includes(data.Vehicles.Vehicle1.ownership));
});

test('counts default to the highest supplied entry and numberOf* can add generated entries', () => {
  const fromEntries = build({ Drivers: { Driver1: {}, Driver2: { firstName: 'Jack' } } });
  assert.equal(fromEntries.numberOfDrivers, '2');
  assert.equal(fromEntries.numberOfInsured, '1');
  assert.equal(fromEntries.Drivers.Driver2.firstName, 'Jack');

  const fromCount = build({ numberOfVehicles: 3, Vehicles: { Vehicle1: { make: 'Ford' } } });
  assert.equal(fromCount.numberOfVehicles, '3');
  assert.deepEqual(keysOf(fromCount.Vehicles), ['Vehicle1', 'Vehicle2', 'Vehicle3']);
  assert.equal(fromCount.Vehicles.Vehicle1.make, 'Ford');
});

test('values are normalised: dates, option labels, VIN case, numbers and booleans', () => {
  const data = build({
    effectiveDate: '2026/10/05',
    Insured: { NamedInsured1: { dateOfBirth: '1990-01-01', gender: 'female', zip: 10017 } },
    Drivers: { Driver1: { dateOfBirth: '1/8/1989', licenseNumber: 9087867562, relationshipToInsured: 'child', yearsLicensed: 6 } },
    Vehicles: { Vehicle1: { vin: 'vin67892ghut623', ownership: 'leased', usage: 'COMMUTE', year: 2020, primaryDriver: 1 } },
    Coverages: { roadSideAssitance: true, medicalPayments: 5000 },
  });
  assert.equal(data.effectiveDate, '10-05-2026');
  assert.equal(data.Insured.NamedInsured1.dateOfBirth, '01-01-1990');
  assert.equal(data.Insured.NamedInsured1.gender, 'Female');
  assert.equal(data.Insured.NamedInsured1.zip, '10017');
  assert.equal(data.Drivers.Driver1.dateOfBirth, '01-08-1989');
  assert.equal(data.Drivers.Driver1.licenseNumber, '9087867562');
  assert.equal(data.Drivers.Driver1.relationshipToInsured, 'Child');
  assert.equal(data.Drivers.Driver1.yearsLicensed, '6');
  assert.equal(data.Vehicles.Vehicle1.vin, 'VIN67892GHUT623');
  assert.equal(data.Vehicles.Vehicle1.ownership, 'Leased');
  assert.equal(data.Vehicles.Vehicle1.usage, 'Commute');
  assert.equal(data.Vehicles.Vehicle1.year, '2020');
  assert.equal(data.Vehicles.Vehicle1.primaryDriver, '1');
  assert.equal(data.Coverages.roadSideAssitance, 'true');
  assert.equal(data.Coverages.medicalPayments, '5000');
});

test('Cancellation is returned exactly as supplied and unknown keys are passed through', () => {
  const cancellation = { type: 'Flat', effectiveDate: '', reason: 'Insured request — sold vehicle', extra: { nested: 1 } };
  const data = build({ Cancellation: cancellation, Drivers: { Driver1: { licenseFile: 'license.png' } }, customFlag: 'yes' });
  assert.deepEqual(data.Cancellation, cancellation);
  assert.notEqual(data.Cancellation, cancellation);
  assert.equal(data.Drivers.Driver1.licenseFile, 'license.png');
  assert.equal(data.customFlag, 'yes');
});

test('the request object is never mutated', () => {
  const input = { Insured: { NamedInsured1: { firstName: 'Joe', isPrimaryInsured: false } }, Drivers: { Driver1: { firstName: 'John', lastName: 'Wick' } } };
  const snapshot = JSON.stringify(input);
  build(input);
  assert.equal(JSON.stringify(input), snapshot);
});

/* ------------------------------------------------------------------ */
/* Negative scenarios                                                   */
/* ------------------------------------------------------------------ */

test('body must be a JSON object', () => {
  for (const input of [[], 'text', 42, true]) {
    assert.throws(() => build(input), (err) => err instanceof ValidationError && err.details[0].path === '$');
  }
});

test('invalid counts', () => {
  expectErrors({ numberOfDrivers: '0' }, 'numberOfDrivers');
  expectErrors({ numberOfInsured: '-1' }, 'numberOfInsured');
  expectErrors({ numberOfVehicles: 'two' }, 'numberOfVehicles');
  expectErrors({ numberOfVehicles: '1.5' }, 'numberOfVehicles');
  expectErrors({ numberOfDrivers: '11' }, 'numberOfDrivers');
  expectErrors({ numberOfDrivers: {} }, 'numberOfDrivers');
  // count lower than the entries supplied
  expectErrors({ numberOfDrivers: '1', Drivers: { Driver1: {}, Driver2: {} } }, 'numberOfDrivers');
});

test('invalid group shapes and keys', () => {
  expectErrors({ Insured: [] }, 'Insured');
  expectErrors({ Drivers: 'John' }, 'Drivers');
  expectErrors({ Vehicles: { Car1: {} } }, 'Vehicles.Car1');
  expectErrors({ Insured: { NamedInsured0: {} } }, 'Insured.NamedInsured0');
  expectErrors({ Insured: { NamedInsured11: {} } }, 'Insured.NamedInsured11');
  expectErrors({ Drivers: { Driver1: 'John Wick' } }, 'Drivers.Driver1');
  expectErrors({ Drivers: { Driver1: ['John'] } }, 'Drivers.Driver1');
  expectErrors({ Coverages: [] }, 'Coverages');
  expectErrors({ Coverages: { collision: { ded: 250 } } }, 'Coverages.collision');
  expectErrors({ Cancellation: 'Flat' }, 'Cancellation');
});

test('invalid dates', () => {
  expectErrors({ effectiveDate: '13-45-2020' }, 'effectiveDate');
  expectErrors({ effectiveDate: 'tomorrow' }, 'effectiveDate');
  expectErrors({ effectiveDate: '02-30-2026' }, 'effectiveDate');
  expectErrors({ Insured: { NamedInsured1: { dateOfBirth: '01-01-2099' } } }, 'Insured.NamedInsured1.dateOfBirth');
  expectErrors({ Drivers: { Driver1: { dateOfBirth: 'not a date' } } }, 'Drivers.Driver1.dateOfBirth');
});

test('invalid option values', () => {
  expectErrors({ Insured: { NamedInsured1: { gender: 'Robot' } } }, 'Insured.NamedInsured1.gender');
  expectErrors({ Drivers: { Driver1: { relationshipToInsured: 'Neighbour' } } }, 'Drivers.Driver1.relationshipToInsured');
  expectErrors({ Vehicles: { Vehicle1: { ownership: 'Borrowed' } } }, 'Vehicles.Vehicle1.ownership');
  expectErrors({ Vehicles: { Vehicle1: { usage: 'Racing' } } }, 'Vehicles.Vehicle1.usage');
});

test('invalid numbers and VIN', () => {
  expectErrors({ Drivers: { Driver1: { accidents: 'many', violations: -1, yearsLicensed: '2.5' } } }, 'Drivers.Driver1.accidents', 'Drivers.Driver1.violations', 'Drivers.Driver1.yearsLicensed');
  expectErrors({ Vehicles: { Vehicle1: { year: '1800' } } }, 'Vehicles.Vehicle1.year');
  expectErrors({ Vehicles: { Vehicle1: { year: '2050' } } }, 'Vehicles.Vehicle1.year');
  expectErrors({ Vehicles: { Vehicle1: { annualMileage: '12,000', costNew: 'cheap' } } }, 'Vehicles.Vehicle1.annualMileage', 'Vehicles.Vehicle1.costNew');
  expectErrors({ Vehicles: { Vehicle1: { primaryDriver: '2' } } }, 'Vehicles.Vehicle1.primaryDriver');
  expectErrors({ Vehicles: { Vehicle1: { primaryDriver: '0' } } }, 'Vehicles.Vehicle1.primaryDriver');
  expectErrors({ Vehicles: { Vehicle1: { vin: '123' } } }, 'Vehicles.Vehicle1.vin');
  expectErrors({ Vehicles: { Vehicle1: { vin: 'ABC376683HJGDJSH' } } }, 'Vehicles.Vehicle1.vin');
  expectErrors({ Vehicles: { Vehicle1: { vin: 'VIN376683HJGDJ$H' } } }, 'Vehicles.Vehicle1.vin');
  expectErrors({ Vehicles: { Vehicle1: { vin: 'VIN376683HJGDJSH12' } } }, 'Vehicles.Vehicle1.vin');
  assert.equal(build({ Vehicles: { Vehicle1: { vin: 'VIN376683HJGDJSH1' } } }).Vehicles.Vehicle1.vin, 'VIN376683HJGDJSH1');
  expectErrors({ Insured: { NamedInsured1: { firstName: { first: 'Joe' } } } }, 'Insured.NamedInsured1.firstName');
});

test('every problem is reported in one response', () => {
  const details = expectErrors(
    {
      effectiveDate: 'bad',
      numberOfDrivers: 'x',
      Insured: { Person1: {} },
      Drivers: { Driver1: { gender: 'Robot', dateOfBirth: '01-01-2099' } },
      Vehicles: { Vehicle1: { vin: '123', usage: 'racing' } },
    },
    'effectiveDate',
    'numberOfDrivers',
    'Insured.Person1',
    'Drivers.Driver1.gender',
    'Drivers.Driver1.dateOfBirth',
    'Vehicles.Vehicle1.vin',
    'Vehicles.Vehicle1.usage',
  );
  assert.equal(details.length, 7);
});
