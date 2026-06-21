const express = require('express');
const session = require('express-session');
const path = require('path');
const routes = require('./routes');

const expressLayouts = require('express-ejs-layouts');

function setupServer() {
    const app = express();

    // Setup view engine
    app.use(expressLayouts);
    app.set('layout', 'layout');
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));

    // Middleware
    app.use(express.static(path.join(__dirname, '../../public')));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // Session setup
    app.use(session({
        secret: process.env.SESSION_SECRET || 'supersecret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false } // Set to true if using https
    }));

    // Routes
    app.use('/', routes);

    return app;
}

module.exports = setupServer;
