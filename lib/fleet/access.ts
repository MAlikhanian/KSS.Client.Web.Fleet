/**
 * The one permission that admits a caller to the Fleet zone.
 *
 * Checked against the session's permission list only. There is deliberately
 * no role check: a role that should see Fleet is given access by being
 * GRANTED this permission in Auth, not by a bypass in the zone.
 *
 * Until the permission exists in Auth and is granted, every caller is refused.
 * That is the intended default.
 */
export const FLEET_READ_PERMISSION = 'Fleet.Read';
