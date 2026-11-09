import { Easing } from 'react-native';

export const motion = {
  duration: { quick: 160, standard: 240, reveal: 320, balance: 400, dialogEnter: 170, dialogExit: 150, shimmer: 400, startupPulse: 375, rowDelete: 160, closeAfterSave: 180, addedRowsReset: 400 },
  delay: { stagger: 36 },
  easing: { standard: Easing.out(Easing.cubic), gentle: Easing.inOut(Easing.quad) },
  spring: { speed: 24, bounciness: 4 },
} as const;
