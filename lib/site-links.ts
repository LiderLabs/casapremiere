// Links between the two sites, now one app: "/" = CASA Premier (estate), "/interior" = CASA Premier Interiors.
// NOTE: usage sites append "/" (e.g. `${X}/`), so the root target is intentionally "".
export const SISTER_SITE_URL = "/interior"; // main site → interior site ("/interior/")
export const MAIN_SITE_URL = ""; // interior site → main site ("/")

// The interiors site's own home, for use *inside* that site - brand logos and
// anything else that means "back to the top of this site" rather than "the other
// site".
//
// This exists because the two apps were merged and both used to answer on "/":
// every `href="/"` inside the interiors pages silently became a link to the
// estate instead of the interiors home, which leaked interior visitors across
// with no attribution. `MAIN_SITE_URL` above means the *other* site and must not
// be used for a site's own logo. The estate side has no equivalent constant
// because its own logos already point at its `#hero` anchor.
export const INTERIOR_HOME = "/interior";

