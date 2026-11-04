// How long after a refresh token was rotated the old value may still be exchanged, once, for a
// fresh pair instead of being treated as stolen (ISS-0028; ported from Proplity's ADR-0016). A
// reload or link click can abort the refresh request after the server rotated the token but
// before the browser stored the new cookie; the browser then retries with the old value. Short on
// purpose: a replay inside the window is accepted once, a replay after it revokes the whole family.
export const REFRESH_GRACE_MS = 5_000;
