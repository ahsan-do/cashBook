import appConfig from '../../app.json';

export const BRAND_MARK = {
  tileDp: 72,
  loaderGlyphDp: 37,
  opticalOffsetDp: 2.16,
} as const;

export const BRAND_COLORS = {
  darkPage: appConfig.expo.splash.backgroundColor,
  limePrimary: appConfig.expo.android.adaptiveIcon.backgroundColor,
} as const;
