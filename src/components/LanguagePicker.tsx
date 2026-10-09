'use client';

/**
 * The first-visit language modal was removed: the site is Turkish by default and the
 * language can be switched from the navbar at any time. The component is kept (and
 * renders nothing) so existing pages that import it keep compiling.
 */
export default function LanguagePicker() {
  return null;
}
