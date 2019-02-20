var express = require('express');
var router = express.Router();
const helpers = require('../helpers/util');
const moment = require('moment');

module.exports = function (pool) {
  var nav = 1;
  /* GET project listing. */
  router.get('/', helpers.isLoggedIn, (req, res, next) => {
    // console.log(req.url);
    const url = req.query.page ? req.url : '/?page=1';
    // console.log(url);
    const page = req.query.page || 1;
    const limit = 3;
    const offset = (page - 1) * limit;
    let searching = false;
    let params = [];

    if (req.query.id && req.query.checkid) {
      params.push(`m.projectid = ${req.query.id}`);
      searching = true;
    }
    if (req.query.name && req.query.checkname) {
      params.push(`p.name ilike '%${req.query.name}%'`);
      searching = true;
    }
    if (req.query.member && req.query.checkmember) {
      params.push(`CONCAT(u.firstname, ' ', u.lastname) = '${req.query.member}'`);
      searching = true;
    }

    let sql = `SELECT COUNT(id) AS total 
               FROM (SELECT DISTINCT p.projectid AS id FROM projects p
               LEFT JOIN members m ON p.projectid = m.projectid 
               LEFT JOIN users u ON m.userid = u.userid`
    if (searching) {
      sql += ` WHERE ${params.join(' AND ')}`
    }
    sql += `) as project_member`

    pool.query(sql, (err, count) => {
      const totalData = count.rows[0].total;
      const pages = Math.ceil(totalData / limit);

      sql = `SELECT DISTINCT p.projectid, p.name
             FROM projects p
             LEFT JOIN members m ON p.projectid = m.projectid
             LEFT JOIN users u ON m.userid = u.userid`
      if (searching) {
        sql += ` WHERE ${params.join(' AND ')}`
      }
      sql += ` ORDER BY p.projectid ASC LIMIT ${limit} OFFSET ${offset}`;

      let subquery = `SELECT DISTINCT p.projectid FROM projects p
                      LEFT JOIN members m ON p.projectid = m.projectid
                      LEFT JOIN users u ON m.userid = u.userid`
      if (searching) {
        subquery += ` WHERE ${params.join(' AND ')}`
      }
      subquery += ` ORDER BY projectid LIMIT ${limit} OFFSET ${offset}`

      let sqlMember = `SELECT p.projectid, CONCAT(u.firstname, ' ', u.lastname) AS fullname
                       FROM members m
                       INNER JOIN projects p ON m.projectid = p.projectid
                       INNER JOIN users u ON m.userid = u.userid 
                       WHERE p.projectid IN (${subquery})`

      pool.query(sql, (err, projectData) => {
        pool.query(sqlMember, (err, memberData) => {
          projectData.rows.map(project => {
            project.members = memberData.rows.filter(member => {
              return member.projectid == project.projectid
            }).map(item => item.fullname)
          })
          pool.query(`SELECT option_project -> 'c_id' AS o1, option_project -> 'c_name' AS o2, option_project -> 'c_member' AS o3 
                      FROM users WHERE userid = ${req.session.user}`, (err, optionData) => {
              if (err) res.send(err);

              pool.query(`SELECT CONCAT(firstname, ' ', lastname) AS name FROM users`, (err, userData) => {
                if (err) res.send(err);
                // res.send(projectData.rows)
                res.render('projects/list', {
                  nav,
                  data: projectData.rows,
                  title: 'Project Management System',
                  user: req.session.user,
                  colId: optionData.rows[0].o1,
                  colName: optionData.rows[0].o2,
                  colMember: optionData.rows[0].o3,
                  dataUser: userData.rows,
                  query: req.query,
                  pagination: {
                    pages,
                    page,
                    url
                  }
                })
              })
            })
        })
      })
    })
  })

  router.post('/option', (req, res, next) => {
    // console.log('dieksekusi', req.body);
    let colId = false;
    let colName = false;
    let colMember = false;

    if (req.body.columnid) {
      colId = true;
    }
    if (req.body.columnname) {
      colName = true;
    }
    if (req.body.columnmember) {
      colMember = true;
    }
    let sql = `UPDATE users SET option_project = option_project::jsonb || 
               '{"c_id":${colId}, "c_name":${colName}, "c_member":${colMember}}' WHERE userid = ${req.session.user}`;
    pool.query(sql, (err) => {
      if (err) {
        console.log(err);
      }
      res.redirect('/projects')
    })
  })

  router.get('/add', helpers.isLoggedIn, (req, res, next) => {
    pool.query(`SELECT * FROM users ORDER BY userid ASC`, (err, data) => {
      // console.log(data.rows);
      if (err) {
        console.log(err);
      }
      res.render('projects/add', {
        data: data.rows,
        nav,
        title: 'Add Project',
        user: req.session.user
      })
    })
  })

  router.post('/add', (req, res, next) => {
    console.log('dieksekusi', req.body);
    pool.query(`INSERT INTO projects (name) VALUES ('${req.body.name}')`, (err) => {
      if (err) {
        console.log(err);
      }
      if (req.body.member) {
        pool.query(`SELECT max(projectid) FROM projects`, (err, lastId) => {
          if (err) {
            console.log(err);
          }
          let projectid = lastId.rows[0].max;
          if (Array.isArray(req.body.member)) {
            let values = [];
            req.body.member.forEach((item) => {
              values.push(`(${projectid}, ${item.split("#")[0]}, '${item.split("#")[1]}')`)
            });
            let sql = `INSERT INTO members (projectid, userid, rool) VALUES `
            sql += values.join(', ')
            pool.query(sql, (err) => {
              console.log(sql);
              if (err) {
                console.log(err);
              }
              res.redirect('/projects')
            })
          } else {
            let userid = req.body.member.split("#")[0];
            let rool = req.body.member.split("#")[1];
            pool.query(`INSERT INTO members (projectid, userid, rool) VALUES (${projectid}, ${userid}, '${rool}')`, (err) => {
              // console.log(sql);
              if (err) {
                console.log(err);
              }
              res.redirect('/projects')
            })
          }
        })
      } else {
        res.redirect('/projects')
      }
    })
  })

  router.get('/edit/:projectid', helpers.isLoggedIn, (req, res, next) => {
    let id = req.params.projectid;
    pool.query(`SELECT * FROM projects WHERE projectid = ${id}`, (err, projectData) => {
      if (err) res.send(err);
      pool.query(`SELECT userid FROM members WHERE projectid= ${id}`, (err, memberData) => {
        if (err) res.send(err);
        pool.query(`SELECT userid, firstname, lastname, position FROM users ORDER BY userid`, (err, userData) => {
          if (err) res.send(err);
          res.render('projects/edit', {
            project: projectData.rows[0],
            members: memberData.rows.map(item => item.userid),
            users: userData.rows,
            nav,
            title: 'Edit Project',
            user: req.session.user
          })
        })
      })
    })
  })

  router.post('/edit/:projectid', (req, res, next) => {
    // console.log('terkoneksi', req.body.name[1]);
    let id = req.params.projectid;
    let projectName = req.body.name[1];
    pool.query(`UPDATE projects SET name = '${projectName}' WHERE projectid = ${id}`, (err) => {
      if (err) res.send(err)
      pool.query(`DELETE FROM members WHERE projectid = ${id}`, (err) => {
        if (err) res.send(err);
        if (req.body.member) {
          if (Array.isArray(req.body.member)) {
            let values = [];
            req.body.member.forEach((item) => {
              values.push(`(${id}, ${item.split("#")[0]}, '${item.split("#")[1]}')`)
            });
            let sql = `INSERT INTO members (projectid, userid, rool) VALUES `
            sql += values.join(', ')
            pool.query(sql, (err) => {
              console.log(sql);
              if (err) {
                console.log(err);
              }
              res.redirect('/projects')
            })
          } else {
            let userid = req.body.member.split("#")[0];
            let rool = req.body.member.split("#")[1];
            pool.query(`INSERT INTO members (projectid, userid, rool) VALUES (${id}, ${userid}, '${rool}')`, (err) => {
              // console.log(sql);
              if (err) {
                console.log(err);
              }
              res.redirect('/projects')
            })
          }
        } else {
          res.redirect('/projects')
        }
      })
    })
  })

  router.get('/delete/:projectid', (req, res, next) => {
    let id = req.params.projectid;
    pool.query(`DELETE FROM members WHERE projectid = ${id}`, (err) => {
      if (err) res.send(err);
      pool.query(`DELETE FROM projects WHERE projectid = ${id}`, (err) => {
        if (err) res.send(err);
        res.redirect('/projects')
      })
    })
  })

  router.get('/:projectid/overview', helpers.isLoggedIn, (req, res, next) => {
    let id = req.params.projectid;
    pool.query(`SELECT CONCAT(u.firstname, ' ', u.lastname) AS fullname 
                FROM users u
                JOIN members m ON u.userid = m.userid
                WHERE m.projectid = ${id}`, (err, dataMember) => {
        if (err) res.send(err);
        pool.query(`SELECT COUNT(tracker) AS bug FROM issues WHERE tracker = 'Bug' AND projectid = ${id}`, (err, tBug) => {
          if (err) res.send(err);
          pool.query(`SELECT COUNT(tracker) AS feature FROM issues WHERE tracker = 'Feature' AND projectid = ${id}`, (err, tFeature) => {
            if (err) res.send(err);
            pool.query(`SELECT COUNT(tracker) AS support FROM issues WHERE tracker = 'Support' AND projectid = ${id}`, (err, tSupport) => {
              if (err) res.send(err);
              pool.query(`SELECT COUNT(tracker) AS bug FROM issues WHERE tracker = 'Bug' AND status != 'Closed' AND projectid = ${id}`, (err, oBug) => {
                if (err) res.send(err);
                pool.query(`SELECT COUNT(tracker) AS feature FROM issues WHERE tracker = 'Feature' AND status != 'Closed' AND projectid = ${id}`, (err, oFeature) => {
                  if (err) res.send(err);
                  pool.query(`SELECT COUNT(tracker) AS support FROM issues WHERE tracker = 'Support' AND status != 'Closed' AND projectid = ${id}`, (err, oSupport) => {
                    if (err) res.send(err);
                    res.render('projects/overview', {
                      nav,
                      title: 'Overview Project',
                      user: req.session.user,
                      data: dataMember.rows,
                      tBug: tBug.rows[0].bug,
                      tFeature: tFeature.rows[0].feature,
                      tSupport: tSupport.rows[0].support,
                      oBug: oBug.rows[0].bug,
                      oFeature: oFeature.rows[0].feature,
                      oSupport: oSupport.rows[0].support,
                      id
                    })
                  })
                })
              })
            })
          })
        })
      })
  })

  router.get('/:projectid/members', helpers.isLoggedIn, (req, res, next) => {
    let id = req.params.projectid;
    const url = req.query.page ? req.url : `/${id}/members/?page=1`;

    const page = req.query.page || 1;
    const limit = 3;
    const offset = (page - 1) * limit;
    let searching = false;
    let params = [];

    if (req.query.id && req.query.checkid) {
      params.push(`u.userid = ${req.query.id}`);
      searching = true;
    }
    if (req.query.name && req.query.checkname) {
      params.push(`firstname ilike '%${req.query.name}%' OR lastname ilike '%${req.query.name}%'`);
      searching = true;
    }
    if (req.query.position && req.query.checkposition) {
      params.push(`position = '${req.query.position}'`);
      searching = true;
    }

    let sql = `SELECT COUNT(*) AS ttl FROM users u
               JOIN members m ON u.userid = m.userid
               JOIN projects p ON m.projectid = p.projectid
               WHERE m.projectid = ${id}`
    if (searching) {
      sql += ` AND ${params.join(' AND ')}`
    }

    pool.query(sql, (err, count) => {
      // console.log(err, count);
      const totalData = count.rows[0].ttl;
      const pages = Math.ceil(totalData / limit);

      sql = `SELECT u.userid, u.firstname, u.lastname, m.rool
             FROM users u
             JOIN members m ON u.userid = m.userid
             JOIN projects p ON m.projectid = p.projectid
             WHERE m.projectid = ${id}`
      if (searching) {
        sql += ` AND ${params.join(' AND ')}`
      }
      sql += ` LIMIT ${limit} OFFSET ${offset}`

      pool.query(sql, (err, data) => {
        if (err) res.send(err)

        pool.query(`SELECT option_members -> 'c_id' AS o1, option_members -> 'c_name' AS o2, option_members -> 'c_position' AS o3
                    FROM users WHERE userid = ${req.session.user}`, (err, optionData) => {
            if (err) res.send(err);
            res.render('members/list', {
              nav,
              data: data.rows,
              colId: optionData.rows[0].o1,
              colName: optionData.rows[0].o2,
              colPosition: optionData.rows[0].o3,
              title: 'Project Members',
              user: req.session.user,
              query: req.query,
              id,
              pagination: {
                pages,
                page,
                url
              }
            })
          })
      })
    })
  })

  router.post('/:projectid/members/option', (req, res, next) => {
    console.log(req.body);
    let id = req.params.projectid;
    let colId = false;
    let colName = false;
    let colPosition = false;

    if (req.body.columnid) {
      colId = true;
    }
    if (req.body.columnname) {
      colName = true;
    }
    if (req.body.columnposition) {
      colPosition = true;
    }

    let sql = `UPDATE users SET option_members = option_members::jsonb || 
               '{"c_id":${colId}, "c_name":${colName}, "c_position":${colPosition}}' WHERE userid = ${req.session.user}`;
    pool.query(sql, (err) => {
      if (err) res.send(err);
      res.redirect(`/projects/${id}/members`)
    })
  })

  router.get('/:projectid/members/add', helpers.isLoggedIn, (req, res, next) => {
    let id = req.params.projectid;
    pool.query(`SELECT userid, firstname, lastname, position FROM users 
                WHERE userid NOT IN
                (SELECT userid FROM members WHERE projectid = ${id})`, (err, dataUser) => {
        if (err) res.send(err);
        res.render('members/add', {
          nav,
          users: dataUser.rows,
          user: req.session.user,
          title: 'Add Project Member',
          id
        })
      })
  })

  router.post('/:projectid/members/add', (req, res, next) => {
    // console.log(req.body);
    let id = req.params.projectid;
    let userid = req.body.userid;
    let rool = req.body.position;
    pool.query(`INSERT INTO members (userid, rool, projectid) VALUES (${userid}, '${rool}', ${id})`, (err) => {
      if (err) res.send(err);
      res.redirect(`/projects/${id}/members`)
    })
  })

  router.get('/:projectid/members/edit/:userid', helpers.isLoggedIn, (req, res, next) => {
    let projectid = req.params.projectid;
    let userid = req.params.userid;
    let sql = `SELECT m.userid, u.firstname, u.lastname, m.rool
               FROM members m JOIN users u ON m.userid = u.userid
               WHERE m.userid = ${userid} AND m.projectid = ${projectid}`
    pool.query(sql, (err, userData) => {
      if (err) res.send(err)
      res.render('members/edit', {
        nav,
        title: 'Edit Project Member',
        users: userData.rows[0],
        user: req.session.user,
        projectid,
        userid
      })
    })
  })

  router.post('/:projectid/members/edit/:userid', (req, res, next) => {
    let projectid = req.params.projectid;
    let userid = req.params.userid;
    let role = req.body.role;
    pool.query(`UPDATE members SET rool = '${role}' WHERE projectid = ${projectid} AND userid = ${userid}`, (err) => {
      if (err) res.send(err);
      res.redirect(`/projects/${projectid}/members`)
    })
  })

  router.get('/:projectid/members/delete/:userid', (req, res, next) => {
    let id = req.params.projectid;
    let userid = req.params.userid
    pool.query(`DELETE FROM members WHERE userid = ${userid} AND projectid = ${id}`, (err) => {
      if (err) res.send(err)
      res.redirect(`/projects/${id}/members`)
    })
  })

  router.get('/:projectid/issues', helpers.isLoggedIn, (req, res, next) => {
    let id = req.params.projectid;
    const url = req.query.page ? req.url : `/${id}/issues/?page=1`;
    const page = req.query.page || 1;
    const limit = 3;
    const offset = (page - 1) * limit;
    let searching = false;
    let params = [];

    if (req.query.id && req.query.checkid) {
      params.push(`issueid = ${req.query.id}`);
      searching = true;
    }
    if (req.query.subject && req.query.checksubject) {
      params.push(`subject ilike '%${req.query.subject}%'`);
      searching = true;
    }
    if (req.query.tracker && req.query.checktracker) {
      params.push(`tracker = '${req.query.tracker}'`);
      searching = true;
    }

    let sql = `SELECT COUNT(*) AS ttl FROM issues
               WHERE projectid = ${id}`
    if (searching) {
      sql += ` AND ${params.join(' AND ')}`
    }

    pool.query(sql, (err, count) => {
      const totalData = count.rows[0].ttl;
      const pages = Math.ceil(totalData / limit);

      sql = `SELECT issueid, subject, tracker, status
             FROM issues
             WHERE projectid = ${id}`
      if (searching) {
        sql += ` AND ${params.join(' AND ')}`
      }
      sql += ` ORDER BY issueid ASC LIMIT ${limit} OFFSET ${offset}`

      pool.query(sql, (err, data) => {
        if (err) res.send(err)

        pool.query(`SELECT option_issues -> 'c_id' AS o1, option_issues -> 'c_subject' AS o2, option_issues -> 'c_tracker' AS o3
                    FROM users WHERE userid = ${req.session.user}`, (err, optionData) => {
            if (err) res.send(err);
            res.render('issues/list', {
              nav,
              data: data.rows,
              colId: optionData.rows[0].o1,
              colSubject: optionData.rows[0].o2,
              colTracker: optionData.rows[0].o3,
              title: 'Project Issues',
              user: req.session.user,
              query: req.query,
              id,
              pagination: {
                pages,
                page,
                url
              }
            })
          })
      })
    })
  })

  router.post('/:projectid/issues/option', (req, res, next) => {
    // console.log(req.body);
    let id = req.params.projectid;
    let colId = false;
    let colSubject = false;
    let colTracker = false;

    if (req.body.columnid) {
      colId = true;
    }
    if (req.body.columnsubject) {
      colSubject = true;
    }
    if (req.body.columntracker) {
      colTracker = true;
    }

    let sql = `UPDATE users SET option_issues = option_issues::jsonb || 
               '{"c_id":${colId}, "c_subject":${colSubject}, "c_tracker":${colTracker}}' WHERE userid = ${req.session.user}`;
    pool.query(sql, (err) => {
      if (err) res.send(err);
      res.redirect(`/projects/${id}/issues`)
    })
  })

  router.get('/:projectid/issues/add', helpers.isLoggedIn, (req, res, next) => {
    let id = req.params.projectid;
    pool.query(`SELECT u.userid, CONCAT(u.firstname, ' ', u.lastname) AS fullname FROM users u
                JOIN members m ON u.userid = m.userid WHERE m.projectid = ${id}`, (err, dataUser) => {
      if (err) res.send(err);
      res.render('issues/add', {
        nav,
        users: dataUser.rows,
        user: req.session.user,
        title: 'Add Project Issue',
        id
      })
    })
  })

  router.post('/:projectid/issues/add', (req, res, next) => {
    let id = req.params.projectid;
    let tracker = req.body.tracker;
    let subject = req.body.subject;
    let description = req.body.description;
    let status = req.body.status;
    let assignee = req.body.assignee;
    let priority = req.body.priority;
    let sdate = req.body.sdate;
    let ddate = req.body.ddate;
    let etime = req.body.etime;
    let done = req.body.done;
    let author = req.session.user;

    let file = req.files.filedoc;
    let filename = file.name.toLowerCase().replace(/ /g, '');

    let sql1 = `INSERT INTO issues (projectid, tracker, subject, description, status, priority,
                assignee, startdate, duedate, estimatedtime, done, author, createddate, file) VALUES
                (${id}, '${tracker}', '${subject}', '${description}', '${status}', '${priority}',
                ${assignee}, '${sdate}', '${ddate}', ${etime}, ${done}, ${author}, current_timestamp, '${filename}')`
    let sql2 = `INSERT INTO activity (time, title, description, author) VALUES (current_timestamp,
                '${subject} #${id} (${status})', '${description}', ${author})`

    if (req.files) {
      file.mv(`/home/walyxxi/Desktop/Challenge/pms/public/file_upload/${filename}`, function (err) {
        if (err) console.log(err)
      })
    }

    pool.query(sql1, (err) => {
      if (err) res.send(err)
      pool.query(sql2, (err) => {
        if (err) res.send(err)
        res.redirect(`/projects/${id}/issues`)
      })
    })
  })

  router.get('/:projectid/activity', (req, res, next) => {
    let id = req.params.projectid;
    let sevenDates = helpers.get7Dates();
    let sevenDays = helpers.get7Days();
    pool.query(`SELECT to_char(a.time,'HH:MM') AS hours, a.title, a.description,
                CONCAT(u.firstname, ' ', u.lastname) AS author FROM activity a
                JOIN users u ON a.author = u.userid WHERE time::date = '${sevenDates[0]}'`, (err, dday1) => {
        if (err) res.send(err);
        pool.query(`SELECT to_char(a.time,'HH:MM') AS hours, a.title, a.description,
                  CONCAT(u.firstname, ' ', u.lastname) AS author FROM activity a
                  JOIN users u ON a.author = u.userid WHERE time::date = '${sevenDates[1]}'`, (err, dday2) => {
            if (err) res.send(err);
            pool.query(`SELECT to_char(a.time,'HH:MM') AS hours, a.title, a.description,
                    CONCAT(u.firstname, ' ', u.lastname) AS author FROM activity a
                    JOIN users u ON a.author = u.userid WHERE time::date = '${sevenDates[2]}'`, (err, dday3) => {
                if (err) res.send(err);
                pool.query(`SELECT to_char(a.time,'HH:MM') AS hours, a.title, a.description,
                      CONCAT(u.firstname, ' ', u.lastname) AS author FROM activity a
                      JOIN users u ON a.author = u.userid WHERE time::date = '${sevenDates[3]}'`, (err, dday4) => {
                    if (err) res.send(err);
                    pool.query(`SELECT to_char(a.time,'HH:MM') AS hours, a.title, a.description,
                        CONCAT(u.firstname, ' ', u.lastname) AS author FROM activity a
                        JOIN users u ON a.author = u.userid WHERE time::date = '${sevenDates[4]}'`, (err, dday5) => {
                        if (err) res.send(err);
                        pool.query(`SELECT to_char(a.time,'HH:MM') AS hours, a.title, a.description,
                          CONCAT(u.firstname, ' ', u.lastname) AS author FROM activity a
                          JOIN users u ON a.author = u.userid WHERE time::date = '${sevenDates[5]}'`, (err, dday6) => {
                            if (err) res.send(err);
                            pool.query(`SELECT to_char(a.time,'HH:MM') AS hours, a.title, a.description,
                            CONCAT(u.firstname, ' ', u.lastname) AS author FROM activity a
                            JOIN users u ON a.author = u.userid WHERE time::date = '${sevenDates[6]}'`, (err, dday7) => {
                                if (err) res.send(err);
                                res.render(`projects/activity`, {
                                  nav,
                                  sdate: sevenDates[0],
                                  edate: sevenDates[6],
                                  dataDay1: dday1.rows,
                                  dataDay2: dday2.rows,
                                  dataDay3: dday3.rows,
                                  dataDay4: dday4.rows,
                                  dataDay5: dday5.rows,
                                  dataDay6: dday6.rows,
                                  dataDay7: dday7.rows,
                                  day2: sevenDays[1],
                                  day3: sevenDays[2],
                                  day4: sevenDays[3],
                                  day5: sevenDays[4],
                                  day6: sevenDays[5],
                                  day7: sevenDays[6],
                                  user: req.session.user,
                                  title: 'Project Activity',
                                  moment,
                                  id
                                })
                              })
                          })
                      })
                  })
              })
          })
      })
  })

  router.get('/:projectid/issues/edit/:issueid', helpers.isLoggedIn, (req, res, next) => {
    let projectid = req.params.projectid;
    let issueid = req.params.issueid;
    pool.query(`SELECT * FROM issues WHERE issueid = ${issueid} AND projectid = ${projectid}`, (err, dataIssues) => {
      if (err) res.send(err);
      pool.query(`SELECT u.userid, CONCAT(u.firstname, ' ', u.lastname) AS fullname FROM users u
                  JOIN members m ON u.userid = m.userid WHERE m.projectid = ${projectid}`, (err, dataUsers) => {
          if (err) res.send(err);
          pool.query(`SELECT issueid, tracker, subject FROM issues WHERE projectid = ${projectid} AND issueid
                    NOT IN (SELECT issueid FROM issues WHERE issueid = ${issueid})`, (err, allIssues) => {
              if (err) res.send(err);
              res.render('issues/edit', {
                nav,
                alliss: allIssues.rows,
                issues: dataIssues.rows[0],
                users: dataUsers.rows,
                user: req.session.user,
                title: 'Edit Project Issue',
                projectid,
                issueid,
                moment
              })
            })
        })
    })
  })

  router.post('/:projectid/issues/edit/:issueid', (req, res, next) => {
    let id = req.params.projectid;
    let issueid = req.params.issueid;
    let tracker = req.body.tracker;
    let subject = req.body.subject;
    let description = req.body.description;
    let status = req.body.status;
    let priority = req.body.priority;
    let assignee = req.body.assignee;
    let sdate = req.body.sdate;
    let ddate = req.body.ddate;
    let etime = req.body.etime;
    let done = req.body.done;
    let file = req.body.file;
    let stime = req.body.stime;
    let tversion = req.body.tversion;
    let ptask = req.body.ptask;

    let sql1 = `UPDATE issues SET tracker = '${tracker}', subject = '${subject}', description = '${description}', status = '${status}',
                priority = '${priority}', assignee = ${assignee}, startdate = '${sdate}', duedate = '${ddate}', estimatedtime = ${etime},
                done = ${done}, file = '${file}', spenttime = ${stime}, targetversion = '${tversion}', parrenttask = ${ptask}, 
                closeddate = current_timestamp WHERE issueid = ${issueid}`
    let sql2 = `UPDATE issues SET tracker = '${tracker}', subject = '${subject}', description = '${description}', status = '${status}',
                priority = '${priority}', assignee = ${assignee}, startdate = '${sdate}', duedate = '${ddate}', estimatedtime = ${etime},
                done = ${done}, file = '${file}', spenttime = ${stime}, targetversion = '${tversion}', parrenttask = ${ptask}, 
                updateddate = current_timestamp WHERE issueid = ${issueid}`

    if (status == 'Closed') {
      pool.query(sql1, (err) => {
        if (err) res.send(err);
        pool.query(`INSERT INTO activity (time, title, description, author) VALUES (current_timestamp,
                    '${subject} #${id} (${status})', '${description}', ${author})`, (err) => {
            if (err) res.send(err)
            res.redirect(`/projects/${id}/issues`)
          })
      })
    } else {
      pool.query(sql2, (err) => {
        if (err) res.send(err);
        pool.query(`INSERT INTO activity (time, title, description, author) VALUES (current_timestamp,
                    '${subject} #${id} (${status})', '${description}', ${author})`, (err) => {
            if (err) res.send(err)
            res.redirect(`/projects/${id}/issues`)
          })
      })
    }
  })

  router.get('/:projectid/issues/delete/:issueid', (req, res, next) => {
    let issueid = req.params.issueid;
    let id = req.params.projectid;
    pool.query(`DELETE FROM issues WHERE issueid = ${issueid}`, (err) => {
      if (err) res.send(err);
      res.redirect(`/projects/${id}/issues`)
    })
  })

  return router;
}