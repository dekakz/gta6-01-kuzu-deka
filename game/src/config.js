// City, balance and tuning constants for Solmar Bay.
// Every number the other systems share lives here so a tweak in one place
// retunes driving, police, missions and the economy together.
export const CITY = {
  name: 'Solmar Bay',
  // Playable ground is a square centred on the origin; the beach and the
  // sea sit along its south edge (positive z).
  halfSize: 320,
  roadSpacing: 64,
  roadWidth: 14,
  blockSize: 50,
  seaLevel: -0.4,
  beachStart: 288,
};

export const PLAYER = {
  walkSpeed: 9,
  runSpeed: 15,
  healthMax: 100,
  startMoney: 250,
  startRespect: 0,
};

export const CAR = {
  accel: 26,
  brake: 42,
  reverseAccel: 14,
  maxSpeed: 46,
  maxReverse: 12,
  steer: 1.9,
  grip: 0.92,
};

export const WANTED = {
  max: 5,
  // Wanted decays one star per decaySeconds, but only while no police unit
  // can see the player (police.js) — hiding clears heat, time alone does not.
  decaySeconds: 14,
  copsPerLevel: [0, 2, 3, 4, 5, 6],
  heliFromLevel: 3,
  roadblockFromLevel: 4,
  heatPerKill: 0.55,
  heatPerCarjack: 0.6,
  heatPerCrash: 0.05,
};

export const RESPECT_RANKS = [
  { min: 0, name: 'Nobody' },
  { min: 100, name: 'Street Kid' },
  { min: 300, name: 'Hustler' },
  { min: 700, name: 'Wheelman' },
  { min: 1400, name: 'Shot Caller' },
  { min: 2500, name: 'King of Solmar' },
];

export function respectRank(respect) {
  let rank = RESPECT_RANKS[0];
  for (const entry of RESPECT_RANKS) if (respect >= entry.min) rank = entry;
  return rank.name;
}

// Palette: a sun-soaked coastal city — warm stucco, pastel towers,
// turquoise sea, orange dusk light. No real-world city copied.
export const PALETTE = {
  skyTop: 0x2f7fc4,
  skyBottom: 0xffd9a0,
  sun: 0xffe3b3,
  sea: 0x1e8fa8,
  sand: 0xe8c98f,
  asphalt: 0x3a3f46,
  sidewalk: 0x9a938a,
  building: [0xf2d8b3, 0xe8b4a0, 0xcfe3ea, 0xf7e6c8, 0xd9c2e8, 0xbfe0c2, 0xf0c98f, 0xa8c8e0],
  car: [0xd23c2e, 0x2e6fd2, 0xe8b62a, 0x3aa655, 0xe8e8e8, 0x22242a, 0x8a4fd2, 0xe87aa0],
};

export const RADIO_STATIONS = [
  { id: 'sol', name: 'SOL FM 98.5 — Sunny Hits', bpm: 112, root: 57, scale: [0, 3, 5, 7, 10] },
  { id: 'bay', name: 'BAYWAVE 104.1 — Sunset Groove', bpm: 92, root: 50, scale: [0, 2, 5, 7, 9] },
  { id: 'turbo', name: 'TURBO 88.9 — Night Drive', bpm: 128, root: 45, scale: [0, 3, 5, 6, 10] },
];

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 2.4, rate: 0.45, ammo: Infinity, auto: false },
  pistol: { name: 'P9 Pistol', damage: 22, range: 42, rate: 0.28, ammo: 120, auto: false },
  smg: { name: 'Kestrel SMG', damage: 14, range: 36, rate: 0.09, ammo: 240, auto: true },
  shotgun: { name: 'Bulldog Shotgun', damage: 55, range: 18, rate: 0.8, ammo: 48, auto: false },
  rifle: { name: 'Longshot Rifle', damage: 45, range: 70, rate: 0.5, ammo: 90, auto: false },
};

export const SHOPS = [
  { id: 'ammo', name: 'Ammo-Nation Solmar', kind: 'weapons', x: -96, z: -32 },
  { id: 'burger', name: 'Burger Barn', kind: 'food', x: 96, z: 32 },
  { id: 'clothes', name: 'Neon Threads', kind: 'clothes', x: -32, z: 96 },
];

export const GARAGE = { x: -96, z: 96, name: "Lena's Garage" };

// Mission roster: twelve story missions. Stage types are handled by
// missions.js: goto, steal, deliver, fight, survive, escape, collect.
export const MISSION_DEFS = [
  {
    id: 1, title: 'Welcome to Solmar', giver: 'Lena Ortiz',
    brief: 'Fresh off the ferry, Dario needs wheels and a friend. Drive to Lena\'s garage and meet the crew.',
    rewardMoney: 300, rewardRespect: 60,
    stages: [
      { type: 'goto', label: 'Drive to Lena\'s Garage', x: GARAGE.x, z: GARAGE.z, radius: 8, dialog: 'LENA: Dario! You made it off the ferry. Come to my garage — I got work for you.' },
      { type: 'goto', label: 'Park inside the garage marker', x: GARAGE.x, z: GARAGE.z, radius: 5, dialog: 'LENA: Nice ride. The city is yours now, kid. First job pays real money.' },
    ],
  },
  {
    id: 2, title: 'Hot Wheels', giver: 'Lena Ortiz',
    brief: 'A Comet GT is parked outside the Marina Hotel. Steal it and bring it back to the garage — the cops will notice.',
    rewardMoney: 800, rewardRespect: 120,
    stages: [
      { type: 'steal', label: 'Steal the Comet GT at the Marina', x: 160, z: -160, radius: 6, dialog: 'LENA: A yellow Comet GT, Marina Hotel valet lane. Take it. Don\'t ask whose it is.' },
      { type: 'deliver', label: 'Deliver the Comet GT to the garage', x: GARAGE.x, z: GARAGE.z, radius: 8, dialog: 'LENA: Clean steal. The buyer pays cash — half is yours.' },
    ],
  },
  {
    id: 3, title: 'Beach Run', giver: 'Milo Reyes',
    brief: 'Milo needs a package run down the coast road before the tide of cops turns. Beat the clock.',
    rewardMoney: 650, rewardRespect: 100,
    stages: [
      { type: 'goto', label: 'Pick up the package at the pier', x: 224, z: 224, radius: 7, timer: 75, dialog: 'MILO: Package is at the south pier. You got 75 seconds before my buyer walks.' },
      { type: 'deliver', label: 'Deliver to the north lookout', x: -224, z: -224, radius: 8, timer: 90, dialog: 'MILO: Drive like the sea is chasing you. North lookout, top of the hill.' },
    ],
  },
  {
    id: 4, title: 'Payback', giver: 'Lena Ortiz',
    brief: 'The Shark Boys jumped Milo on the boardwalk. Go settle it on foot — fists or whatever you carry.',
    rewardMoney: 900, rewardRespect: 160,
    stages: [
      { type: 'goto', label: 'Find the Shark Boys on the boardwalk', x: 96, z: 256, radius: 10, dialog: 'LENA: Four of them, boardwalk by the arcades. Make them remember your name.' },
      { type: 'fight', label: 'Beat down the Shark Boys (0/4)', count: 4, x: 96, z: 256, radius: 16, dialog: 'SHARK BOY: You picked the wrong beach, Vega!' },
    ],
  },
  {
    id: 5, title: 'Bank of Solmar', giver: 'The Professor',
    brief: 'A quiet job at the Bank of Solmar goes loud. Grab the cash and lose the cops — three stars and climbing.',
    rewardMoney: 2500, rewardRespect: 260,
    stages: [
      { type: 'goto', label: 'Reach the Bank of Solmar', x: 32, z: -96, radius: 8, dialog: 'PROFESSOR: In and out, ninety seconds. The vault code is 0417. Go.' },
      { type: 'collect', label: 'Grab the cash bags (0/3)', count: 3, x: 32, z: -96, radius: 12, dialog: 'PROFESSOR: Bags are in the vault room. Move!' },
      { type: 'escape', label: 'Lose the cops — get your wanted level to zero', dialog: 'PROFESSOR: Alarms! Three stars! Shake them and meet me at the garage.' },
      { type: 'goto', label: 'Meet the Professor at the garage', x: GARAGE.x, z: GARAGE.z, radius: 8, dialog: 'PROFESSOR: Beautiful work, Dario. Solmar will remember this one.' },
    ],
  },
  {
    id: 6, title: 'Harbor Lights', giver: 'Milo Reyes',
    brief: 'Three crates washed up at the docks and every crew in town wants them. Collect them all, watch the corners.',
    rewardMoney: 1400, rewardRespect: 200,
    stages: [
      { type: 'collect', label: 'Collect the dock crates (0/3)', count: 3, x: -224, z: 160, radius: 26, dialog: 'MILO: Crates at the west docks. Sharks are sniffing around — bring a gun.' },
      { type: 'fight', label: 'Clear the dock ambush (0/3)', count: 3, x: -224, z: 160, radius: 18, dialog: 'SHARK BOY: Those crates are ours, Vega!' },
      { type: 'deliver', label: 'Deliver the crates to Lena\'s garage', x: GARAGE.x, z: GARAGE.z, radius: 8, dialog: 'MILO: Crates secured. That is a month of rent, brother.' },
    ],
  },
  {
    id: 7, title: 'The Big Score', giver: 'The Professor',
    brief: 'The Solmar Grand casino moves its weekend take in one armored van. Hit it, fight the guards, vanish.',
    rewardMoney: 5000, rewardRespect: 420,
    stages: [
      { type: 'goto', label: 'Intercept the armored van on Casino Row', x: 160, z: 96, radius: 9, timer: 90, dialog: 'PROFESSOR: The van leaves the Grand at noon. Be on Casino Row.' },
      { type: 'fight', label: 'Take down the van guards (0/4)', count: 4, x: 160, z: 96, radius: 18, dialog: 'GUARD: Hands off the van!' },
      { type: 'steal', label: 'Steal the armored van', x: 160, z: 96, radius: 6, dialog: 'PROFESSOR: The van is yours. Drive it like you stole it — because you did.' },
      { type: 'deliver', label: 'Deliver the van to the hideout', x: -224, z: -160, radius: 9, dialog: 'PROFESSOR: Five million in casino chips. We are legends now, Dario.' },
    ],
  },
  {
    id: 8, title: 'King of Solmar', giver: 'Lena Ortiz',
    brief: 'The Shark Boys called every cop and every thug in Solmar on you. Survive the storm, then take the penthouse.',
    rewardMoney: 10000, rewardRespect: 800,
    stages: [
      { type: 'survive', label: 'Survive the five-star storm', seconds: 75, x: 0, z: 0, radius: 40, dialog: 'LENA: The whole city is coming for you. Survive 75 seconds and Solmar is yours!' },
      { type: 'goto', label: 'Reach the Solmar Grand penthouse', x: 160, z: 96, radius: 8, dialog: 'LENA: The penthouse. The crown. Go take what is yours, King of Solmar.' },
    ],
  },
  {
    id: 9, title: 'Casino Royale', giver: 'The Professor',
    brief: 'The Solmar Grand keeps its chips in the back room. Slip in, grab the trays and walk out before the alarm finds you.',
    rewardMoney: 3200, rewardRespect: 300,
    stages: [
      { type: 'goto', label: 'Reach the Solmar Grand casino', x: 160, z: 96, radius: 9, dialog: 'PROFESSOR: Chips are in the back room, three trays. Quiet feet, Dario.' },
      { type: 'collect', label: 'Grab the chip trays (0/3)', count: 3, x: 160, z: 96, radius: 12, dialog: 'PROFESSOR: Trays are on the table. Take them all.' },
      { type: 'escape', label: 'Lose the cops — get your wanted level to zero', dialog: 'PROFESSOR: The alarm! Shake the heat, then meet me at the garage.' },
      { type: 'goto', label: 'Meet the Professor at the garage', x: GARAGE.x, z: GARAGE.z, radius: 8, dialog: 'PROFESSOR: Three trays, no blood. You are a professional now.' },
    ],
  },
  {
    id: 10, title: 'Street Kings', giver: 'Lena Ortiz',
    brief: 'A rival crew challenged the whole city to a street race: pier to lookout to garage, against the clock. No cops invited — they came anyway.',
    rewardMoney: 2800, rewardRespect: 320,
    stages: [
      { type: 'goto', label: 'Start at the south pier', x: 224, z: 224, radius: 7, timer: 60, dialog: 'LENA: Pier first, 60 seconds. The whole city is watching, Vega.' },
      { type: 'goto', label: 'Race to the north lookout', x: -224, z: -224, radius: 8, timer: 75, dialog: 'LENA: Lookout next! Do not lift off that gas pedal.' },
      { type: 'deliver', label: 'Finish at Lena\'s garage', x: GARAGE.x, z: GARAGE.z, radius: 8, timer: 60, dialog: 'LENA: Home stretch! Garage, now — Street King!' },
    ],
  },
  {
    id: 11, title: 'The Shark\'s Debt', giver: 'Milo Reyes',
    brief: 'The Shark Boys owe Milo for the boardwalk job and they pay in crates, not cash. Take the docks, take the crates.',
    rewardMoney: 3800, rewardRespect: 380,
    stages: [
      { type: 'fight', label: 'Clear the dock crew (0/4)', count: 4, x: -224, z: 160, radius: 18, dialog: 'MILO: Four of them guarding my crates. The debt is due.' },
      { type: 'collect', label: 'Collect the payment crates (0/3)', count: 3, x: -224, z: 160, radius: 24, dialog: 'MILO: Crates are the payment. Load them up.' },
      { type: 'deliver', label: 'Deliver the crates to the garage', x: GARAGE.x, z: GARAGE.z, radius: 8, dialog: 'MILO: Debt paid. The Sharks will think twice next time.' },
    ],
  },
  {
    id: 12, title: 'The Last Sunset', giver: 'Lena Ortiz',
    brief: 'One last job: the Shark boss\'s gold Comet GT sits at the Marina. Take it, take down his guards, and park it at the penthouse. Solmar Bay is yours.',
    rewardMoney: 12000, rewardRespect: 1000,
    stages: [
      { type: 'steal', label: 'Steal the gold Comet GT at the Marina', x: 160, z: -160, radius: 6, dialog: 'LENA: Gold Comet, Marina valet. The Shark boss\'s pride. Take it.' },
      { type: 'fight', label: 'Take down the Shark guards (0/4)', count: 4, x: 160, z: -160, radius: 18, dialog: 'GUARD: That car belongs to the boss!' },
      { type: 'deliver', label: 'Park the Comet at the penthouse', x: 160, z: 96, radius: 9, dialog: 'LENA: The penthouse, Dario. Park it where the whole city can see it.' },
      { type: 'survive', label: 'Hold the penthouse — survive 60 seconds', seconds: 60, x: 160, z: 96, radius: 40, dialog: 'LENA: They are coming for the crown. Hold it for 60 seconds and Solmar Bay is yours, forever.' },
    ],
  },
];
