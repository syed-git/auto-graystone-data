import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, ENDPOINT } from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function call(method, path, { body, headers = {} } = {}) {
  const res = await fetch(baseUrl + path, { method, headers, body });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, headers: res.headers, json, text };
}

const post = (body, headers) =>
  call('POST', ENDPOINT, {
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });

const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
};

test('POST without a body returns the defaults', async () => {
  const res = await call('POST', ENDPOINT);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(res.json.effectiveDate, today());
  assert.equal(res.json.numberOfInsured, '1');
  assert.equal(res.json.numberOfDrivers, '1');
  assert.equal(res.json.numberOfVehicles, '1');
  assert.equal(res.json.Insured.NamedInsured1.isPrimaryInsured, 'true');
  assert.equal(res.json.Drivers.Driver1.relationshipToInsured, 'Insured');
  assert.match(res.json.Vehicles.Vehicle1.vin, /^VIN[A-Z0-9]{12}$/);
  assert.deepEqual(res.json.Coverages, { bodilyInjuryLiability: '50k/100k', propertyDamageLiability: '50k', collision: '$250 ded' });
});

test('POST with an empty JSON object or an empty string body returns the defaults', async () => {
  for (const body of ['{}', '']) {
    const res = await post(body);
    assert.equal(res.status, 200, body);
    assert.equal(res.json.numberOfDrivers, '1');
  }
});

test('POST without a Content-Type header still parses the JSON body', async () => {
  const res = await call('POST', ENDPOINT, { body: JSON.stringify({ numberOfDrivers: '2' }) });
  assert.equal(res.status, 200);
  assert.equal(res.json.numberOfDrivers, '2');
  assert.deepEqual(Object.keys(res.json.Drivers), ['Driver1', 'Driver2']);
});

test('POST with a partial body echoes supplied values and fills the rest', async () => {
  const res = await post({
    numberOfDrivers: '2',
    Insured: { NamedInsured1: { firstName: 'Joe', lastName: 'Biden', email: 'joe.biden@example.com' } },
    Vehicles: { Vehicle1: { primaryDriver: '2', ownership: 'Leased' } },
    Coverages: { collision: '$500 ded', rentalReimbursement: '$30/day' },
    Cancellation: { type: 'Flat', effectiveDate: '', reason: 'Insured request' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.Insured.NamedInsured1.firstName, 'Joe');
  assert.equal(res.json.Insured.NamedInsured1.email, 'joe.biden@example.com');
  assert.equal('phone' in res.json.Insured.NamedInsured1, false);
  assert.equal(res.json.Vehicles.Vehicle1.primaryDriver, '2');
  assert.equal(res.json.Vehicles.Vehicle1.ownership, 'Leased');
  assert.equal(res.json.Coverages.collision, '$500 ded');
  assert.equal(res.json.Coverages.rentalReimbursement, '$30/day');
  assert.equal(res.json.Coverages.bodilyInjuryLiability, '50k/100k');
  assert.deepEqual(res.json.Cancellation, { type: 'Flat', effectiveDate: '', reason: 'Insured request' });
});

test('malformed JSON -> 400', async () => {
  const res = await post('{ "numberOfDrivers": ');
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'Request body is not valid JSON');
});

test('non-object JSON bodies -> 400', async () => {
  for (const body of ['[1, 2]', '"text"', '42', 'true', 'null']) {
    const res = await post(body);
    assert.equal(res.status, 400, body);
    assert.equal(res.json.error, 'Request body must be a JSON object');
  }
});

test('validation problems -> 400 with every detail', async () => {
  const res = await post({
    effectiveDate: 'bad',
    numberOfInsured: 0,
    Drivers: { Driver1: { gender: 'Robot' } },
    Vehicles: { Vehicle1: { vin: 'nope', primaryDriver: '3' } },
  });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'Invalid request body');
  const paths = res.json.details.map((d) => d.path);
  assert.deepEqual(paths.sort(), ['Drivers.Driver1.gender', 'Vehicles.Vehicle1.primaryDriver', 'Vehicles.Vehicle1.vin', 'effectiveDate', 'numberOfInsured'].sort());
});

test('body over the size limit -> 413', async () => {
  const res = await post({ note: 'x'.repeat(250 * 1024) });
  assert.equal(res.status, 413);
});

test('wrong method on the endpoint -> 405 with Allow header', async () => {
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
    const res = await call(method, ENDPOINT);
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get('allow'), 'POST');
  }
});

test('unknown routes -> 404 JSON', async () => {
  const res = await call('POST', '/getautograystonedata-typo');
  assert.equal(res.status, 404);
  assert.equal(res.json.status, 404);
});

test('GET /health and GET / respond', async () => {
  const health = await call('GET', '/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.status, 'ok');
  const root = await call('GET', '/');
  assert.equal(root.status, 200);
  assert.ok(root.json.endpoints[`POST ${ENDPOINT}`]);
});
