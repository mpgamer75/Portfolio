import type { PlanetKind } from './skillsGraph';

/*
 * The mechanics behind the Skills star system. Pure maths: no React, no three.
 *
 * What is physical here, and what is a drawing convention:
 *
 *   - Each planet has a real radius and mean density. Its mass, surface
 *     gravity and escape velocity follow from those.
 *   - Each moon system is drawn TO SCALE with its planet: an orbit that is
 *     2.2 planet radii wide on screen is 2.2 planet radii wide in kilometres.
 *     Moons and satellites move on Kepler ellipses around their planet (the
 *     planet at one focus, equal areas in equal times), with the period that
 *     Kepler's third law gives for that planet's mass.
 *   - One clock runs everything that orbits a planet, TIME_WARP times faster
 *     than real time. At that rate a planet's year takes hours, which is why
 *     the planets hold their places: they are moving, just far too slowly to
 *     see. Their year is still worked out from their distance to the star.
 *   - Ships fly constant-thrust transits: burn for the first half, flip, burn
 *     the other way for the second half. Distance, burn time and peak speed
 *     are the real figures for that thrust; the trip is shown TRANSIT_WARP
 *     times faster than it would take.
 *   - NOT to scale: the size of the bodies against the distances between the
 *     planets (as in any orrery), and the size of the moons.
 */

export const G = 6.6743e-11; // m^3 kg^-1 s^-2
export const AU_KM = 149_597_870.7;
export const SOLAR_MASS = 1.98847e30; // kg
export const G0 = 9.80665; // m s^-2

/** Simulated seconds per scene second, for everything that orbits a planet. */
export const TIME_WARP = 400;
/** Simulated seconds per scene second, for a ship in transit. */
export const TRANSIT_WARP = 23_000;
/** Mass of the star (it sets the length of each planet's year). */
export const STAR_MASS = SOLAR_MASS;
/** Constant thrust of every ship, in g. */
export const SHIP_THRUST_G = 0.5;

const TAU = Math.PI * 2;

/* ── Planets ─────────────────────────────────────────────────────────────── */

interface PlanetSpec {
  /** Mean radius, km. */
  radiusKm: number;
  /** Mean density, kg/m^3. */
  density: number;
  /** Length of a day (one turn on its axis), hours. */
  dayHours: number;
  /** Semi-major axis of its orbit round the star, AU. */
  orbitAU: number;
  /** What kind of world this is, in a few words. */
  type: string;
}

const PLANET_SPECS: Record<PlanetKind, PlanetSpec> = {
  terran: { radiusKm: 6200, density: 5500, dayHours: 24, orbitAU: 1.0, type: 'Ocean world' },
  ice: { radiusKm: 2600, density: 1900, dayHours: 40, orbitAU: 1.6, type: 'Ice world' },
  gas: { radiusKm: 58_000, density: 690, dayHours: 10.6, orbitAU: 2.2, type: 'Ringed gas giant' },
  forge: { radiusKm: 5400, density: 6400, dayHours: 18, orbitAU: 0.7, type: 'Volcanic world' },
};

export interface PlanetPhysics extends PlanetSpec {
  /** kg */
  massKg: number;
  /** Standard gravitational parameter G*M, m^3/s^2. */
  mu: number;
  /** Surface gravity, in g. */
  gravityG: number;
  /** Escape velocity at the surface, km/s. */
  escapeKmS: number;
  /** Length of its year, days (Kepler's third law round the star). */
  yearDays: number;
  /** Spin, radians per scene second. */
  spinRate: number;
}

function derivePlanet(spec: PlanetSpec): PlanetPhysics {
  const r = spec.radiusKm * 1000;
  const massKg = (4 / 3) * Math.PI * r * r * r * spec.density;
  const mu = G * massKg;
  const a = spec.orbitAU * AU_KM * 1000;
  return {
    ...spec,
    massKg,
    mu,
    gravityG: mu / (r * r) / G0,
    escapeKmS: Math.sqrt((2 * mu) / r) / 1000,
    yearDays: (TAU * Math.sqrt((a * a * a) / (G * STAR_MASS))) / 86_400,
    spinRate: TAU / ((spec.dayHours * 3600) / TIME_WARP),
  };
}

export const PLANET_PHYSICS: Record<PlanetKind, PlanetPhysics> = {
  terran: derivePlanet(PLANET_SPECS.terran),
  ice: derivePlanet(PLANET_SPECS.ice),
  gas: derivePlanet(PLANET_SPECS.gas),
  forge: derivePlanet(PLANET_SPECS.forge),
};

/* ── Orbits round a planet ───────────────────────────────────────────────── */

/**
 * Period (real seconds) of an orbit whose semi-major axis is `radii` planet
 * radii: T = 2*pi*sqrt(a^3 / mu). Because mu grows with R^3, this depends only
 * on the planet's density — a light gas giant's moons are slow, a dense
 * world's are quick.
 */
export function orbitalPeriod(planet: PlanetPhysics, radii: number): number {
  const a = radii * planet.radiusKm * 1000;
  return TAU * Math.sqrt((a * a * a) / planet.mu);
}

/** Mean motion in radians per scene second for that orbit. */
export function meanMotion(planet: PlanetPhysics, radii: number): number {
  return (TAU / orbitalPeriod(planet, radii)) * TIME_WARP;
}

/**
 * Kepler's equation, M = E - e*sin(E), solved for the eccentric anomaly E by
 * Newton's method. Four steps are exact to machine precision at the small
 * eccentricities used here. E stays continuous with M (it is not wrapped).
 */
export function solveKepler(meanAnomaly: number, e: number): number {
  let E = meanAnomaly + e * Math.sin(meanAnomaly);
  for (let i = 0; i < 4; i++) {
    E -= (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
  }
  return E;
}

/** Distance from the focus, in units of the semi-major axis, at eccentric anomaly E. */
export const orbitRadius = (E: number, e: number) => 1 - e * Math.cos(E);

/**
 * Orbital speed in km/s from the vis-viva equation, v^2 = mu*(2/r - 1/a), with
 * `r` and `a` in planet radii.
 */
export function visViva(planet: PlanetPhysics, rRadii: number, aRadii: number): number {
  const scale = planet.radiusKm * 1000;
  return Math.sqrt(planet.mu * (2 / (rRadii * scale) - 1 / (aRadii * scale))) / 1000;
}

/* ── Ships: constant-thrust transits ─────────────────────────────────────── */

export const FLIGHT_BURN = 0;
export const FLIGHT_FLIP = 1;
export const FLIGHT_BRAKE = 2;
export const FLIGHT_DOCKED = 3;
export const FLIGHT_LABELS = ['Accelerating', 'Flipping', 'Braking', 'Docked'];

/** Share of a leg, either side of its midpoint, spent coasting through the flip. */
const FLIP_HALF = 0.045;
const BURN_END = 0.5 - FLIP_HALF;
/** Acceleration in "leg lengths per (leg time)^2" that covers exactly one leg. */
const BURN_ACCEL = 1 / (BURN_END * (BURN_END + 2 * FLIP_HALF));
const PEAK_SPEED = BURN_ACCEL * BURN_END;

export interface FlightState {
  /** 0..1 along the leg. */
  progress: number;
  /** 0..1 of the peak speed. */
  speed: number;
  /** FLIGHT_* */
  mode: number;
  /** 0 = nose along the direction of travel, 1 = turned right round (retro-burn). */
  turn: number;
  /** 0..1 engine throttle. */
  thrust: number;
}

/**
 * Where a ship is at `tau` (0..1) of a leg: uniform acceleration to the flip,
 * a short coast while it turns end over end, then the same deceleration to
 * arrive at rest. s = a*t^2/2 on the way up, mirrored on the way down.
 */
export function flightAt(tau: number, out: FlightState): FlightState {
  const t = tau < 0 ? 0 : tau > 1 ? 1 : tau;
  if (t < BURN_END) {
    out.progress = 0.5 * BURN_ACCEL * t * t;
    out.speed = (BURN_ACCEL * t) / PEAK_SPEED;
    out.mode = FLIGHT_BURN;
    out.turn = 0;
    out.thrust = Math.min(1, t / 0.02);
  } else if (t <= 1 - BURN_END) {
    const k = (t - BURN_END) / (2 * FLIP_HALF);
    out.progress = 0.5 * BURN_ACCEL * BURN_END * BURN_END + PEAK_SPEED * (t - BURN_END);
    out.speed = 1;
    out.mode = FLIGHT_FLIP;
    out.turn = k * k * (3 - 2 * k);
    out.thrust = 0;
  } else {
    const left = 1 - t;
    out.progress = 1 - 0.5 * BURN_ACCEL * left * left;
    out.speed = (BURN_ACCEL * left) / PEAK_SPEED;
    out.mode = FLIGHT_BRAKE;
    out.turn = 1;
    out.thrust = Math.min(1, left / 0.02);
  }
  return out;
}

export interface Transit {
  /** Straight-line distance of the leg, AU. */
  distanceAU: number;
  /** Real duration of one leg, seconds. */
  seconds: number;
  /** Peak speed at the flip, km/s. */
  peakKmS: number;
  /** Duration of one leg on screen, scene seconds. */
  sceneSeconds: number;
}

/**
 * A leg between two planets `a1` and `a2` AU from the star and `angle` radians
 * apart as seen from it (law of cosines), flown at SHIP_THRUST_G with the
 * profile above.
 */
export function transitBetween(a1: number, a2: number, angle: number): Transit {
  const distanceAU = Math.sqrt(a1 * a1 + a2 * a2 - 2 * a1 * a2 * Math.cos(angle));
  const d = distanceAU * AU_KM * 1000;
  const accel = SHIP_THRUST_G * G0;
  // In leg units the profile needs BURN_ACCEL; in metres it is given `accel`.
  const seconds = Math.sqrt((BURN_ACCEL * d) / accel);
  return {
    distanceAU,
    seconds,
    peakKmS: (accel * BURN_END * seconds) / 1000,
    sceneSeconds: seconds / TRANSIT_WARP,
  };
}

/* ── Formatting ──────────────────────────────────────────────────────────── */

const INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** 13330 → "13,330 km" */
export const formatKm = (km: number) => `${INT.format(Math.round(km / 10) * 10)} km`;

/** A real duration, in the unit that reads best. */
export function formatDuration(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  const days = hours / 24;
  if (days < 730) return `${days.toFixed(days < 20 ? 1 : 0)} days`;
  return `${(days / 365.25).toFixed(1)} years`;
}

export const formatSpeed = (kmS: number) =>
  kmS >= 100 ? `${INT.format(kmS)} km/s` : `${kmS.toFixed(kmS < 10 ? 2 : 1)} km/s`;
