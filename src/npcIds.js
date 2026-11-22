export const NPC = {
  teacher: 'v-yldnxahi',
  vendor: 'v-j4ios9cq',
  keeper: 'v-2s08a739',
  cook: 'v-d1oiaxzt',
  fishmonger: 'v-uv173puo',
  grocer: 'v-9ye3yu2y',
  chief: 'v-xfqs23uo',
  mayor: 'v-t1t4b5xo',
  guardHung: 'v-dw1fhtkg',
  guardDung: 'v-cptp2ido',
  guardLuc: 'v-g9e8otlb',
  guardManh: 'v-68vrasy7',
};

export const classTeacherOf = (deck) => `class:${deck}`;

export const LEGACY_NPC_IDS = new Map([
  ['teacher', NPC.teacher],
  ['vendor', NPC.vendor],
  ['keeper', NPC.keeper],
  ['cook', NPC.cook],
  ['fishmonger', NPC.fishmonger],
  ['grocer', NPC.grocer],
  ['chief', NPC.chief],
  ['mayor', NPC.mayor],
  ['guard-hung', NPC.guardHung],
  ['guard-dung', NPC.guardDung],
  ['guard-luc', NPC.guardLuc],
  ['guard-manh', NPC.guardManh],
]);
