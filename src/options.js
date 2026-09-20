/** Option lists and defaults shared by the validator and the generator. */

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
export const OWNERSHIP_OPTIONS = ['Owned', 'Leased', 'Rented'];
export const USAGE_OPTIONS = ['Pleasure', 'Commute', 'Business', 'Farm'];
export const RELATIONSHIP_OPTIONS = ['Insured', 'Spouse', 'Child', 'Parent', 'Other'];

export const DEFAULT_RELATIONSHIP = 'Insured';

export const REQUIRED_INSURED_FIELDS = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'isPrimaryInsured'];
export const OPTIONAL_INSURED_FIELDS = ['email', 'phone', 'address', 'city', 'state', 'zip'];

export const REQUIRED_DRIVER_FIELDS = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'licenseNumber', 'relationshipToInsured'];
export const OPTIONAL_DRIVER_FIELDS = ['licenseState', 'yearsLicensed', 'accidents', 'violations'];

export const REQUIRED_VEHICLE_FIELDS = ['year', 'make', 'model', 'vin', 'ownership'];
export const OPTIONAL_VEHICLE_FIELDS = ['usage', 'annualMileage', 'costNew', 'primaryDriver'];

/** Coverages that are always present; the value is used when the request does not supply one. */
export const DEFAULT_COVERAGES = {
  bodilyInjuryLiability: '50k/100k',
  propertyDamageLiability: '50k',
  collision: '$250 ded',
};
export const OPTIONAL_COVERAGES = ['uninsuredMotorist', 'medicalPayments', 'comprehensive', 'rentalReimbursement', 'roadSideAssitance'];

export const GROUPS = {
  Insured: { countKey: 'numberOfInsured', prefix: 'NamedInsured' },
  Drivers: { countKey: 'numberOfDrivers', prefix: 'Driver' },
  Vehicles: { countKey: 'numberOfVehicles', prefix: 'Vehicle' },
};

/** Upper bound for numberOfInsured / numberOfDrivers / numberOfVehicles. */
export const MAX_ENTRIES = 10;

/** Generated VINs are exactly 15 characters; supplied ones may use up to the real-world 17. */
export const VIN_PATTERN = /^VIN[A-Z0-9]{12,14}$/;
export const LICENSE_NUMBER_LENGTH = 10;
