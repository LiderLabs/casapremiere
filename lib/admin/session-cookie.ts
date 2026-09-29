// The admin session cookie's name, in its own module so the three places that need it - the
// proxy (which must stay tiny and dependency-free), the auth core and the route handlers -
// cannot drift apart.

export const SESSION_COOKIE = "casa_admin_session";
