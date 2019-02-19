var express = require('express');
var router = express.Router();

module.exports = function (pool) {

  /* GET home page. */
  router.get('/', (req, res) => {
    res.render('login', { title: 'PMS Login', loginMessage: req.flash('loginMessage') });
  });

  router.post('/', (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    let sql = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
    pool.query(sql, (err, users) => {
      // console.log(users.rows);
      if(err){
        console.log(err);
      }
      if(users.rows.length > 0){
        req.session.user = users.rows[0].userid
        res.redirect('/projects')
      } else {
        req.flash('loginMessage', 'Username or Password Invalid!')
        res.redirect('/')
      }
    })
  })

  router.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/')
    })
  })

  return router;
}
