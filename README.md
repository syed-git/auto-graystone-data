# auto-graystone-data

REST API that builds **AutoGraystone** personal-auto test data sets. It exposes a single data endpoint,
`POST /getAutoGraystoneData`, that takes an optional *partial* data set and returns a complete one: whatever you
send is kept, every mandatory value you leave out is generated, and optional values are only present when you sent
them. Deployable to [Render](https://render.com) as-is (`render.yaml`).

```
POST /getAutoGraystoneData   build a data set (body optional)
GET  /health                 liveness probe used by Render
GET  /                       service description
```

## Run locally

```bash
npm install
npm start                     # http://localhost:4000  (PORT env var overrides the port)
npm test                      # node:test unit + API tests
npm run lint
```

```bash
curl -X POST http://localhost:4000/getAutoGraystoneData                       # defaults
curl -X POST http://localhost:4000/getAutoGraystoneData \
     -H 'Content-Type: application/json' \
     -d '{ "numberOfDrivers": "2", "Vehicles": { "Vehicle1": { "ownership": "Leased", "primaryDriver": "2" } } }'
```

## Deploy to Render

1. Push this repository to GitHub.
2. Render dashboard → **New** → **Blueprint** → select the repository. Render reads `render.yaml` (free web service,
   Node 22, `npm ci --omit=dev` / `npm start`, health check on `/health`).
3. The service is reachable at `https://<service-name>.onrender.com/getAutoGraystoneData`
   (`https://auto-graystone-data.onrender.com/getAutoGraystoneData` unless Render had to suffix the name).

Free instances spin down when idle; the first request after a pause can take ~30-60 s. Alternatively create a
*Web Service* by hand with build command `npm ci --omit=dev` and start command `npm start` - the app listens on
`process.env.PORT`.

## Response

With no request body (or `{}`) the response has today's `effectiveDate`, one insured, one driver and one vehicle:

```json
{
  "effectiveDate": "09-20-2026",
  "numberOfInsured": "1",
  "numberOfDrivers": "1",
  "numberOfVehicles": "1",
  "Insured":  { "NamedInsured1": { "firstName": "Sarah", "lastName": "Jackson", "dateOfBirth": "01-18-1996", "gender": "Female", "isPrimaryInsured": "true" } },
  "Drivers":  { "Driver1": { "firstName": "Robert", "lastName": "Johnson", "dateOfBirth": "06-12-1976", "gender": "Male", "licenseNumber": "6949583102", "relationshipToInsured": "Insured" } },
  "Vehicles": { "Vehicle1": { "year": "2018", "make": "BMW", "model": "X5", "vin": "VIN42K2KGKTSDRA", "ownership": "Rented" } },
  "Coverages": { "bodilyInjuryLiability": "50k/100k", "propertyDamageLiability": "50k", "collision": "$250 ded" }
}
```

Every key the API understands, with sample values (all values are strings):

```json
{
  "effectiveDate": "09-20-2026",
  "numberOfInsured": "1",
  "numberOfDrivers": "1",
  "numberOfVehicles": "1",
  "Insured": {
    "NamedInsured1": {
      "firstName": "Joe", "lastName": "Biden", "dateOfBirth": "09-01-1989", "gender": "Male", "isPrimaryInsured": "true",
      "email": "joe.biden@example.com", "phone": "2125550123", "address": "227 Park Ave", "city": "New York", "state": "NY", "zip": "10017"
    }
  },
  "Drivers": {
    "Driver1": {
      "firstName": "John", "lastName": "Wick", "dateOfBirth": "09-01-1979", "gender": "Male", "licenseNumber": "7494797412",
      "licenseState": "NY", "yearsLicensed": "15", "accidents": "0", "violations": "0", "relationshipToInsured": "Insured"
    }
  },
  "Vehicles": {
    "Vehicle1": {
      "year": "2020", "make": "Toyota", "model": "Camry", "vin": "VIN376683HJGDJS", "ownership": "Owned",
      "usage": "Commute", "annualMileage": "12000", "costNew": "28999", "primaryDriver": "1"
    }
  },
  "Coverages": {
    "bodilyInjuryLiability": "50k/100k", "propertyDamageLiability": "50k", "uninsuredMotorist": "50k/100k", "medicalPayments": "1k",
    "comprehensive": "$250 ded", "collision": "$250 ded", "rentalReimbursement": "$30/day", "roadSideAssitance": "true"
  },
  "Cancellation": { "type": "Flat", "effectiveDate": "", "reason": "Insured request" }
}
```

## Rules

| Section | Mandatory (generated when missing) | Optional (returned only when sent) | Defaults / normalisation |
| --- | --- | --- | --- |
| top level | `effectiveDate` = today; `numberOfInsured`, `numberOfDrivers`, `numberOfVehicles` = number of entries you sent, else `1` | - | counts may be raised to add generated entries (max 10) |
| `Insured.NamedInsuredN` | `firstName`, `lastName`, `dateOfBirth` (adult), `gender` | `email`, `phone`, `address`, `city`, `state`, `zip` | `isPrimaryInsured` is `"true"` for `NamedInsured1` and `"false"` for every other insured, whatever you send |
| `Drivers.DriverN` | `firstName`, `lastName`, `dateOfBirth`, `gender`, `licenseNumber` (10 digits) | `licenseState`, `yearsLicensed`, `accidents`, `violations` | `relationshipToInsured` defaults to `Insured` |
| `Vehicles.VehicleN` | `year` (last 10 years), `make`, `model`, `vin`, `ownership` | `usage`, `annualMileage`, `costNew`, `primaryDriver` | generated `vin` = `VIN` + 12 upper-case alphanumerics (15 chars); `ownership` picked from `Owned`, `Leased`, `Rented` |
| `Coverages` | `bodilyInjuryLiability` = `50k/100k`, `propertyDamageLiability` = `50k`, `collision` = `$250 ded` | `uninsuredMotorist`, `medicalPayments`, `comprehensive`, `rentalReimbursement`, `roadSideAssitance` | values are returned as sent (as strings) |
| `Cancellation` | - | whole object | returned exactly as sent |

Normalisation applied to supplied values:

* Dates accept `MM-DD-YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `YYYY/MM/DD` or an ISO timestamp and are returned as `MM-DD-YYYY`.
* Option fields are matched case-insensitively (and by prefix): `gender` → `Male | Female | Other`,
  `ownership` → `Owned | Leased | Rented`, `usage` → `Pleasure | Commute | Business | Farm`,
  `relationshipToInsured` → `Insured | Spouse | Child | Parent | Other`.
* `vin` is upper-cased and must be `VIN` + 12-14 alphanumerics.
* Numbers and booleans are converted to strings (`accidents: 2` → `"2"`, `roadSideAssitance: true` → `"true"`);
  blank strings and `null` count as "not sent".
* Generated people never share a full name. Keys the API does not know (e.g. `Drivers.Driver1.licenseFile`) are
  returned untouched.

## Errors (negative scenarios)

All errors are JSON: `{ "status": <code>, "error": "<summary>", "details": [{ "path", "message" }] }`.
Validation collects **every** problem before answering, so one round-trip shows them all.

| Status | When |
| --- | --- |
| `400 Request body is not valid JSON` | malformed JSON |
| `400 Request body must be a JSON object` | body is an array, string, number, boolean or `null` |
| `400 Invalid request body` | any of: `numberOf*` not a whole number 1-10, or lower than the entries sent; a group (`Insured`, `Drivers`, `Vehicles`, `Coverages`, `Cancellation`) that is not an object; keys other than `NamedInsuredN` / `DriverN` / `VehicleN`; an entry that is not an object; an unparseable date or a `dateOfBirth` in the future; `gender` / `ownership` / `usage` / `relationshipToInsured` outside the option lists; a non-numeric `yearsLicensed`, `accidents`, `violations`, `annualMileage`, `costNew`; `year` outside 1900..next year; `primaryDriver` that does not point at an existing driver; a `vin` that is not `VIN` + alphanumerics; a scalar field given an object/array |
| `405` | any method other than `POST` on `/getAutoGraystoneData` (`Allow: POST`) |
| `404` | unknown route |
| `413` | body larger than 200 kB |

```json
{
  "status": 400,
  "error": "Invalid request body",
  "details": [
    { "path": "effectiveDate", "message": "\"13-45-2020\" is not a valid date; use MM-DD-YYYY" },
    { "path": "Vehicles.Vehicle1.vin", "message": "\"123\" must be 15-17 alphanumeric characters starting with VIN" },
    { "path": "Vehicles.Vehicle1.primaryDriver", "message": "\"5\" must be a whole number between 1 and 1" }
  ]
}
```

## Layout

```
server.js            starts the HTTP server (PORT, graceful shutdown)
src/app.js           Express app: routes, body parsing, error mapping
src/generator.js     validation + generation (buildAutoGraystoneData)
src/random.js        random values for mandatory fields
src/options.js       option lists, optional-field lists, coverage defaults
src/dates.js         MM-DD-YYYY parsing/formatting
test/*.test.js       node:test unit tests (generator) and HTTP tests (app)
render.yaml          Render blueprint
.github/workflows    lint + tests on every push / PR
```

Used by [syed-git/codeceptjs-puppeteer](https://github.com/syed-git/codeceptjs-puppeteer): `await I.getAutoGraystoneData(partial)` calls this endpoint.
