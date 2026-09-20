import { addDays, addYears, toGraystoneDate } from './dates.js';
import { GENDER_OPTIONS, LICENSE_NUMBER_LENGTH, OWNERSHIP_OPTIONS } from './options.js';

const FIRST_NAMES = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Daniel', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Walker', 'Hall'];
const MAKES = {
  Toyota: ['Camry', 'Corolla', 'RAV4', 'Highlander'],
  Honda: ['Civic', 'Accord', 'CRV', 'Pilot'],
  Ford: ['F150', 'Escape', 'Explorer', 'Mustang'],
  Chevrolet: ['Malibu', 'Equinox', 'Silverado', 'Tahoe'],
  Nissan: ['Altima', 'Rogue', 'Sentra', 'Pathfinder'],
  BMW: ['X3', 'X5', 'Series3', 'Series5'],
  Tesla: ['Model3', 'ModelY', 'ModelS'],
};
/** No I, O or Q - the characters excluded from real VINs. */
const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

export const random = {
  int(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  },
  digits(length) {
    return Array.from({ length }, () => random.int(0, 9)).join('');
  },
  alphanumeric(length) {
    return Array.from({ length }, () => VIN_CHARS[random.int(0, VIN_CHARS.length - 1)]).join('');
  },
  firstName: () => random.pick(FIRST_NAMES),
  lastName: () => random.pick(LAST_NAMES),
  /** Adult date of birth (25-65 years old) in MM-DD-YYYY. */
  dateOfBirth(now = new Date()) {
    const base = addYears(now, -random.int(25, 65));
    return toGraystoneDate(addDays(base, -random.int(0, 364)));
  },
  gender: () => random.pick(GENDER_OPTIONS),
  licenseNumber: () => random.digits(LICENSE_NUMBER_LENGTH),
  /** "VIN" + 12 upper-case alphanumerics = 15 characters. */
  vin: () => `VIN${random.alphanumeric(12)}`,
  makeModel() {
    const make = random.pick(Object.keys(MAKES));
    return [make, random.pick(MAKES[make])];
  },
  year: (now = new Date()) => String(random.int(now.getFullYear() - 10, now.getFullYear())),
  ownership: () => random.pick(OWNERSHIP_OPTIONS),
};
