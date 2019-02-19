var express = require('express');
var router = express.Router();
const helpers = require('../helpers/util');

module.exports = function (pool) {
    let nav = 3;

    router.get('/', helpers.isLoggedIn, (req, res, next) => {
        pool.query(`SELECT * FROM users ORDER BY userid ASC`, (err, data) => {
            if (err) res.send(err);
            res.render('users/list', {
                nav,
                data: data.rows,
                title: 'Users',
                user: req.session.user
            })
        })
    })

    router.get('/add', helpers.isLoggedIn, (req, res, next) => {
        res.render('users/add', {
            nav,
            title: 'Add User',
            user: req.session.user
        })
    })

    router.post('/add', (req, res, next) => {
        let firstname = req.body.firstname;
        let lastname = req.body.lastname;
        let email = req.body.email;
        let password = req.body.password;
        let position = req.body.position;
        let type = false;
        if (req.body.type) {
            type = true;
        }
        let sql = `INSERT INTO users (firstname, lastname, email, password, position, type, 
                   option_project, option_members, option_issues) VALUES 
                   ('${firstname}', '${lastname}', '${email}', '${password}', '${position}', ${type},
                   ('{"c_id": true, "c_name": true, "c_member": false}'),
                   ('{"c_id": true, "c_name": true, "c_position": false}'),
                   ('{"c_id": true, "c_subject": true, "c_tracker": false}'))`
        pool.query(sql, (err) => {
            if (err) res.send(err);
            res.redirect('/users')
        })
    })

    router.get('/edit/:userid', helpers.isLoggedIn, (req, res, next) => {
        let id = req.params.userid
        pool.query(`SELECT * FROM users WHERE userid = ${id}`, (err, data) => {
            if (err) res.send(err);
            res.render('users/edit', {
                nav,
                data: data.rows[0],
                title: 'Edit User',
                user: req.session.user
            })
        })
    })

    router.post('/edit/:userid', (req, res, next) => {
        let id = req.params.userid;
        let firstname = req.body.firstname;
        let lastname = req.body.lastname;
        let email = req.body.email;
        let password = req.body.password;
        let position = req.body.position;
        let type = false;
        if (req.body.type) {
            type = true;
        }
        let sql = `UPDATE users SET firstname = '${firstname}', lastname = '${lastname}', email = '${email}',
                   password = '${password}', position = '${position}', type = ${type} WHERE userid = ${id}`  
        pool.query(sql, (err) => {
            if (err) res.send(err);
            res.redirect('/users')
        })
    })

    router.get('/delete/:userid', (req, res, next) => {
        let id = req.params.userid;
        pool.query(`DELETE FROM users WHERE userid = ${id}`, (err) => {
            if (err) res.send(err);
            res.redirect('/users')
        })
    })

    return router;
}