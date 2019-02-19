var express = require('express');
var router = express.Router();
const helpers = require('../helpers/util');

module.exports = function (pool) {

    router.get('/', helpers.isLoggedIn, (req, res, next) => {
        let nav = 2;
        pool.query(`SELECT * FROM users WHERE userid = ${req.session.user}`, (err, data) => {
            res.render('profiles/profile', { 
                nav, 
                title: 'Profile', 
                data: data.rows[0], 
                user: req.session.user, 
                isPassword: req.flash('isPassword') 
            })
        })
    })

    router.post('/update', (req, res, next) => {
        // console.log('dieksekusi', req.url);
        let email = req.body.email;
        let password = req.body.password
        let position = '';
        let type = false;
        if (req.body.position) {
            position = req.body.position;
        }
        if (req.body.type) {
            type = true;
        }
        if (!req.body.password) {
            pool.query(`UPDATE users SET email = '${email}', position = '${position}', type = ${type} WHERE userid = ${req.session.user}`, (err) => {
                if (err) {
                    console.log(err);
                }
                res.redirect('/profiles')
            })
        } else {
            pool.query(`UPDATE users SET email = '${email}', password = '${password}', position = '${position}', type = ${type} WHERE userid = ${req.session.user}`, (err) => {
                if (err) {
                    console.log(err);
                }
                res.redirect('/profiles')
            })
        }
    })

    return router;
}