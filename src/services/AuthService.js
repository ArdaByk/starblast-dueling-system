class AuthService {
    static validateLogin(password) {
        return password === process.env.PANEL_PASSWORD;
    }

    static isAuthenticated(req) {
        return req.session && req.session.authenticated === true;
    }

    static requireAuth(req, res, next) {
        if (AuthService.isAuthenticated(req)) {
            res.locals.authenticated = true;
            return next();
        }
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ success: false, error: 'Session expired. Please refresh the page and log in again.' });
        }
        res.redirect('/login');
    }
}

module.exports = AuthService;
