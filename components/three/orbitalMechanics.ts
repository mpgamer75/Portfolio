import type { PlanetKind } from './skillsGraph';

/*
 * The mechanics behind the Skills star system. Pure maths: no React, no three.
 *
 * KEPLER — every orbit here is a Kepler ellipse with the body it orbits at one
 * focus, stepped by solving Kepler's equation, so each body sweeps equal areas
 * in equal times. Periods come from Kepler's third law: a planet's year from
 * its distance to the star, a moon's month from its distance to its planet.
 *
 * NEWTON — masses follow from each planet's radius and density; surface
 * gravity, escape velocity and the gravitational parameter of every orbit
 * follow from the mass. Ships obey F = m*a: a constant thrust for the first
 * half of a transit, the same thrust reversed for the second, aimed at where
 * the destination planet WILL be when they arrive.
 *
 * EINSTEIN — general relativity turns each planetary ellipse a little every
 * orbit (the perihelion advance); it is applied, at its true size. Clocks run
 * slow deep in a gravity well and aboard a fast ship; light takes minutes to
 * cross the system. At these masses and speeds all of this is real but tiny,
 * so it shows in the figures of the readouts, not in the picture.
 *
 * What is a drawing convention, not physics:
 *   - Two clocks. Everything that goes round the star (planets, ships) is
 *     played HELIO_WARP times faster than real time; everything that goes
 *     round a planet (moons, satellites, a planet's own spin) MOON_WARP times.
 *     On one clock, either the planets would not visibly move or the moons
 *     would be a blur.
 *   - Planetary orbits are to scale with each other (AU_PER_UNIT), and each
 *     moon system is to scale with its planet — but the planets themselves are
 *     drawn thousands of times too large for their orbits, as in any orrery.
 *   - Planets do not pull on each other, and ships ignore the star's pull
 *     (about a tenth of their thrust at most).
 */

export const G = 6.6743e-11; // m^3 kg^-1 s^-2
export const C = 299_792_458; // m/s
export const AU_KM = 149_597_870.7;
export const SOLAR_MASS = 1.98847e30; // kg
export const G0 = 9.80665; // m s^-2

/** Simulated seconds per scene second for whatever orbits the star. */
export const HELIO_WARP = 120_000;
/** Simulated seconds per scene second for whatever orbits a planet. */
export const MOON_WARP = 400;
/** Astronomical units per scene unit, for distances from the star. */
export const AU_PER_UNIT = 0.27;
/** Mass of the star, and its gravitational parameter. */
export const STAR_MASS = SOLAR_MASS;
const STAR_MU = G * STAR_MASS;
/** Constant thrust of every ship, in g. */
export const SHIP_THRUST_G = 0.015;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/* ── Planets ─────────────────────────────────────────────────────────────── */

interface PlanetSpec {
  /** Mean radius, km. */
  radiusKm: number;
  /** Mean density, kg/m^3. */
  density: number;
  /** Length of a day (one turn on its axis), hours. */
  dayHours: number;
  /** Its orbit round the star: semi-major axis (AU) and eccentricity… */
  orbitAU: number;
  ecc: number;
  /** …argument of perihelion, inclination to the ecliptic, ascending node, and where it starts (degrees). */
  periDeg: number;
  inclDeg: number;
  nodeDeg: number;
  startDeg: number;
  /** What kind of world this is, in a few words. */
  type: string;
}

const PLANET_SPECS: Record<PlanetKind, PlanetSpec> = {
  forge: {
    radiusKm: 5400, density: 6400, dayHours: 18, type: 'Volcanic world',
    orbitAU: 0.75, ecc: 0.09, periDeg: 40, inclDeg: 3.2, nodeDeg: 20, startDeg: 205,
  },
  terran: {
    radiusKm: 6200, density: 5500, dayHours: 24, type: 'Ocean world',
    orbitAU: 1.25, ecc: 0.03, periDeg: 110, inclDeg: 0, nodeDeg: 0, startDeg: 330,
  },
  ice: {
    radiusKm: 2600, density: 1900, dayHours: 40, type: 'Ice world',
    orbitAU: 1.8, ecc: 0.07, periDeg: 250, inclDeg: 2.1, nodeDeg: 140, startDeg: 95,
  },
  gas: {
    radiusKm: 58_000, density: 690, dayHours: 10.6, type: 'Ringed gas giant',
    orbitAU: 2.5, ecc: 0.05, periDeg: 15, inclDeg: 1.3, nodeDeg: 250, startDeg: 160,
  },
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
  /** Length of its year, days (Kepler's third law). */
  yearDays: number;
  /** Semi-major axis of its orbit, scene units. */
  orbitScene: number;
  /** Mean motion round the star, radians per scene second. */
  helioMotion: number;
  /** Mean anomaly at time 0, radians. */
  anomaly0: number;
  /** General-relativistic advance of its perihelion: radians per orbit, and arcseconds per century. */
  precession: number;
  precessionArcsecCentury: number;
  /** How much slower a clock on its surface runs than one far away, microseconds per day. */
  clockLagMicrosDay: number;
  /** Radius of its Hill sphere (inside which its own gravity wins over the star's), in planet radii. */
  hillRadii: number;
  /** Spin, radians per scene second. */
  spinRate: number;
}

function derivePlanet(spec: PlanetSpec): PlanetPhysics {
  const r = spec.radiusKm * 1000;
  const massKg = (4 / 3) * Math.PI * r * r * r * spec.density;
  const mu = G * massKg;
  const a = spec.orbitAU * AU_KM * 1000;
  const year = TAU * Math.sqrt((a * a * a) / STAR_MU);
  // Schwarzschild perihelion advance per orbit: 6*pi*G*M / (c^2 * a * (1 - e^2)).
  const precession = (6 * Math.PI * STAR_MU) / (C * C * a * (1 - spec.ecc * spec.ecc));
  return {
    ...spec,
    massKg,
    mu,
    gravityG: mu / (r * r) / G0,
    escapeKmS: Math.sqrt((2 * mu) / r) / 1000,
    yearDays: year / 86_400,
    orbitScene: spec.orbitAU / AU_PER_UNIT,
    helioMotion: (TAU / year) * HELIO_WARP,
    anomaly0: spec.startDeg * DEG,
    precession,
    precessionArcsecCentury: ((precession / DEG) * 3600 * (36_525 * 86_400)) / year,
    // Gravitational time dilation, weak field: G*M / (r * c^2), as a rate.
    clockLagMicrosDay: (mu / (r * C * C)) * 86_400e6,
    hillRadii: (a * (1 - spec.ecc) * Math.cbrt(massKg / (3 * STAR_MASS))) / r,
    spinRate: TAU / ((spec.dayHours * 3600) / MOON_WARP),
  };
}

export const PLANET_PHYSICS: Record<PlanetKind, PlanetPhysics> = {
  terran: derivePlanet(PLANET_SPECS.terran),
  ice: derivePlanet(PLANET_SPECS.ice),
  gas: derivePlanet(PLANET_SPECS.gas),
  forge: derivePlanet(PLANET_SPECS.forge),
};

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

/** What `helioState` reports besides the position. */
export const HELIO = { E: 0, peri: 0, node: 0, incl: 0 };

/**
 * Where a planet is at heliocentric time `t` (scene seconds), in scene units
 * with the star at the origin and the ecliptic as the XZ plane (+Y north,
 * motion anticlockwise seen from the north). Writes [x, y, z] into `out` at
 * `o`, and its eccentric anomaly and current perihelion into HELIO.
 *
 * The ellipse itself turns: the argument of perihelion advances by the
 * relativistic precession for every orbit completed.
 */
export function helioState(p: PlanetPhysics, t: number, out: Float32Array | number[], o = 0): void {
  const turned = p.helioMotion * t;
  const E = solveKepler(p.anomaly0 + turned, p.ecc);
  const peri = p.periDeg * DEG + (p.precession * turned) / TAU;
  const x = p.orbitScene * (Math.cos(E) - p.ecc);
  const y = p.orbitScene * Math.sqrt(1 - p.ecc * p.ecc) * Math.sin(E);
  // In the orbital plane, perihelion along +x; then the three classical turns.
  const cw = Math.cos(peri);
  const sw = Math.sin(peri);
  const xp = x * cw - y * sw;
  const yp = x * sw + y * cw;
  const incl = p.inclDeg * DEG;
  const yi = yp * Math.cos(incl);
  const up = yp * Math.sin(incl);
  const node = p.nodeDeg * DEG;
  const cn = Math.cos(node);
  const sn = Math.sin(node);
  out[o] = xp * cn - yi * sn;
  out[o + 1] = up;
  out[o + 2] = -(xp * sn + yi * cn);
  HELIO.E = E;
  HELIO.peri = peri;
  HELIO.node = node;
  HELIO.incl = incl;
}

/**
 * Orbital speed round the star in km/s, from the vis-viva equation
 * v^2 = mu*(2/r - 1/a), with r and a in AU.
 */
export function helioSpeed(rAU: number, aAU: number): number {
  const au = AU_KM * 1000;
  return Math.sqrt(STAR_MU * (2 / (rAU * au) - 1 / (aAU * au))) / 1000;
}

/** Seconds light takes to cover a distance given in AU. */
export const lightSeconds = (distanceAU: number) => (distanceAU * AU_KM * 1000) / C;

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
  return (TAU / orbitalPeriod(planet, radii)) * MOON_WARP;
}

/** Orbital speed round a planet in km/s (vis-viva), with `r` and `a` in planet radii. */
export function visViva(planet: PlanetPhysics, rRadii: number, aRadii: number): number {
  const scale = planet.radiusKm * 1000;
  return Math.sqrt(planet.mu * (2 / (rRadii * scale) - 1 / (aRadii * scale))) / 1000;
}

/* ── Ships: constant-thrust transits ─────────────────────────────────────── */

export const FLIGHT_BURN = 0;
export const FLIGHT_FLIP = 1;
export const FLIGHT_BRAKE = 2;
export const FLIGHT_DOCKED = 3;
export const FLIGHT_LABELS = ['Accelerating', 'Flipping', 'Braking', 'In parking orbit'];

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
 * Where a ship is at `tau` (0..1) of a leg: uniform acceleration to the flip
 * (s = a*t^2/2), a short coast while it turns end over end, then the same
 * deceleration to arrive at rest.
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

/**
 * How long a leg of `units` scene units takes at SHIP_THRUST_G with the
 * profile above, in real seconds. (In leg units the profile needs BURN_ACCEL;
 * in metres it is given the thrust — the ratio is the time squared.)
 */
export function transitSeconds(units: number): number {
  const metres = units * AU_PER_UNIT * AU_KM * 1000;
  return Math.sqrt((BURN_ACCEL * metres) / (SHIP_THRUST_G * G0));
}

/** The same leg's duration on screen (scene seconds), and its peak speed in km/s. */
export const transitSceneSeconds = (units: number) => transitSeconds(units) / HELIO_WARP;
export const transitPeakKmS = (units: number) => (SHIP_THRUST_G * G0 * BURN_END * transitSeconds(units)) / 1000;

/**
 * Special-relativistic clock lag of a ship moving at `kmS`: the fraction of a
 * second it loses per second, 1 - sqrt(1 - v^2/c^2).
 */
export function lorentzLag(kmS: number): number {
  const beta = (kmS * 1000) / C;
  return 1 - Math.sqrt(1 - beta * beta);
}

/* ── Formatting ──────────────────────────────────────────────────────────── */

const INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** 13330 → "13,330 km" */
export const formatKm = (km: number) => `${INT.format(Math.round(km / 10) * 10)} km`;

/** A real duration, in the unit that reads best. */
export function formatDuration(seconds: number): string {
  if (seconds < 1e-3) return `${(seconds * 1e6).toFixed(0)} µs`;
  if (seconds < 1) return `${(seconds * 1000).toFixed(1)} ms`;
  if (seconds < 90) return `${seconds.toFixed(1)} s`;
  const hours = seconds / 3600;
  if (hours < 1) return `${(seconds / 60).toFixed(1)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  const days = hours / 24;
  if (days < 730) return `${days.toFixed(days < 20 ? 1 : 0)} days`;
  return `${(days / 365.25).toFixed(1)} years`;
}

export const formatSpeed = (kmS: number) =>
  kmS >= 100 ? `${INT.format(kmS)} km/s` : `${kmS.toFixed(kmS < 10 ? 2 : 1)} km/s`;
