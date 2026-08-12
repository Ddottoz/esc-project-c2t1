const COOKIE_NAME = 'educatorId';

function authCookieOptions() {
    return {
        signed: true,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
    };
}

function setAuthCookie(res, educatorId) {
    // signed means the educator id cannot be changed in the browser
    res.cookie(COOKIE_NAME, String(educatorId), authCookieOptions());
}

function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME, {path: '/'});
}

function requireAuth(req, res, next) {
    const educatorId = Number(req.signedCookies[COOKIE_NAME]);
    if (!Number.isInteger(educatorId) || educatorId <= 0) {
        clearAuthCookie(res);
        return res.redirect('/login');
    }

    // protected routes can use the logged-in educator without reading the cookie again
    req.educatorId = educatorId;
    res.locals.educatorId = educatorId;
    next();
}

module.exports = {requireAuth, setAuthCookie, clearAuthCookie, authCookieOptions};
