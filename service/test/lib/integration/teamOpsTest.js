
'use strict'

const expect = require('code').expect
const Lab = require('lab')
const lab = exports.lab = Lab.script()
const logger = require('pino')()

const TeamOps = require('../../../lib/teamOps')
const PolicyOps = require('../../../lib/policyOps')
const UserOps = require('../../../lib/userOps')
const dbConn = require('../../../lib/dbConn')

const db = dbConn.create(logger)
const teamOps = TeamOps(db.pool, logger)
const policyOps = PolicyOps(db.pool, logger)
const userOps = UserOps(db.pool, logger)

let testTeamId
const teamData = {
  name: 'Team 4',
  description: 'This is a test team',
  parentId: null,
  organizationId: 'WONKA'
}

lab.experiment('TeamOps', () => {

  lab.test('list of org teams', (done) => {
    teamOps.listOrgTeams({organizationId: 'WONKA'}, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.length).to.equal(6)
      // TODO:      t.deepEqual(result, expectedUserList, 'data should be as expected')

      done()
    })
  })

  lab.test('create, update and delete a team', (done) => {
    teamOps.createTeam(teamData, function (err, result) {
      testTeamId = result.id

      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.name).to.equal('Team 4')

      const updateData = {
        id: testTeamId,
        name: 'Team 5',
        description: 'description',
        users: [1, 2],
        organizationId: 'WONKA'
      }

      teamOps.updateTeam(updateData, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.name).to.equal('Team 5')
        expect(result.users).to.have.length(2)
        expect(result.users).to.only.include([
          {'id': 1, 'name': 'Super User'},
          {'id': 2, 'name': 'Charlie Bucket'}
        ])

        policyOps.listByOrganization({ organizationId: 'WONKA' }, (err, policies) => {
          expect(err).to.not.exist()

          const defaultPolicy = policies.find((p) => { return p.name === 'Default Team Admin for ' + testTeamId })
          expect(defaultPolicy).to.exist()

          teamOps.deleteTeam({ id: testTeamId, organizationId: 'WONKA' }, function (err) {
            expect(err).to.not.exist()

            // check default policy has been deleted
            policyOps.listByOrganization({ organizationId: 'WONKA' }, (err, policies) => {
              expect(err).to.not.exist()

              const defaultPolicy = policies.find((p) => { return p.name === 'Default Team Admin for ' + testTeamId })
              expect(defaultPolicy).to.not.exist()
              done()
            })
          })
        })
      })
    })
  })

  lab.test('create, update only the name and delete a team', (done) => {
    teamOps.createTeam(teamData, function (err, result) {
      testTeamId = result.id

      expect(err).to.not.exist()

      const updateData = {
        id: testTeamId,
        name: 'Team 5',
        organizationId: 'WONKA'
      }

      teamOps.updateTeam(updateData, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.name).to.equal('Team 5')
        expect(result.description).to.equal(teamData.description)

        teamOps.deleteTeam({ id: testTeamId, organizationId: 'WONKA' }, done)
      })
    })
  })

  lab.test('create, update only the description and delete a team', (done) => {
    teamOps.createTeam(teamData, function (err, result) {
      testTeamId = result.id

      expect(err).to.not.exist()

      const updateData = {
        id: testTeamId,
        description: 'new desc',
        organizationId: 'WONKA'
      }

      teamOps.updateTeam(updateData, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.description).to.equal('new desc')
        expect(result.name).to.equal(teamData.name)

        teamOps.deleteTeam({ id: testTeamId, organizationId: 'WONKA' }, done)
      })
    })
  })

  lab.test('create, update only the users and delete a team', (done) => {
    teamOps.createTeam(teamData, function (err, result) {
      testTeamId = result.id

      expect(err).to.not.exist()

      const updateData = {
        id: testTeamId,
        users: [1, 2, 3],
        organizationId: 'WONKA'
      }

      teamOps.updateTeam(updateData, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.description).to.equal(teamData.description)
        expect(result.name).to.equal(teamData.name)
        expect(result.users).to.equal([{ id: 2, name: 'Charlie Bucket' }, { id: 3, name: 'Mike Teavee' }, { id: 1, name: 'Super User' }])

        teamOps.deleteTeam({ id: testTeamId, organizationId: 'WONKA' }, done)
      })
    })
  })

  lab.test('read a specific team', (done) => {
    teamOps.readTeam({ id: 1, organizationId: 'WONKA' }, (err, result) => {

      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.users.length).to.equal(1)
      expect(result.policies.length).to.equal(1)

      done()
    })
  })

  lab.test('creating a team should create a default admin policy', (done) => {
    teamOps.createTeam(teamData, function (err, result) {
      expect(err).to.not.exist()
      expect(result).to.exist()

      policyOps.listByOrganization({organizationId: 'WONKA'}, (err, policies) => {
        expect(err).to.not.exist()

        const defaultPolicy = policies.find((p) => { return p.name === 'Default Team Admin for ' + result.id })
        expect(defaultPolicy).to.exist()

        policyOps.deletePolicy({ id: defaultPolicy.id, organizationId: 'WONKA' }, (err) => {
          expect(err).to.not.exist()

          teamOps.deleteTeam({ id: result.id, organizationId: 'WONKA' }, done)
        })
      })
    })
  })

  lab.test('creating a team with createOnly option should not create a default admin policy', (done) => {
    teamOps.createTeam(teamData, { createOnly: true }, function (err, result) {
      expect(err).to.not.exist()
      expect(result).to.exist()

      policyOps.listByOrganization({organizationId: 'WONKA'}, (err, policies) => {
        expect(err).to.not.exist()

        const defaultPolicy = policies.find((p) => {
          return p.name === 'Default Team Admin for ' + result.id
        })
        expect(defaultPolicy).to.not.exist()

        teamOps.deleteTeam({ id: result.id, organizationId: 'WONKA' }, done)
      })
    })
  })

  lab.test('create team support creation of default team admin user', (done) => {
    teamData.user = { name: 'Team 6 Admin' }

    teamOps.createTeam(teamData, function (err, team) {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.users).to.exist()

      const defaultUser = team.users.find((u) => { return u.name === 'Team 6 Admin' })
      expect(defaultUser).to.exist()

      userOps.readUser({ id: defaultUser.id, organizationId: 'WONKA' }, (err, user) => {
        expect(err).to.not.exist()

        expect(user.name).to.be.equal('Team 6 Admin')

        const defaultPolicy = user.policies.find((p) => { return p.name === 'Default Team Admin for ' + team.id })
        expect(defaultPolicy).to.exist()

        teamOps.deleteTeam({ id: team.id, organizationId: 'WONKA' }, (err) => {
          expect(err).to.not.exist()

          userOps.deleteUser({ id: user.id, organizationId: 'WONKA' }, done)
        })
      })
    })
  })

  lab.test('createTeam should build path', (done) => {
    const teamData = {
      name: 'Team Child',
      description: 'This is a test team for paths',
      parentId: 1,
      organizationId: 'WONKA'
    }

    teamOps.createTeam(teamData, function (err, result) {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.path).to.equal('1.' + result.id)

      teamOps.deleteTeam({ id: result.id, organizationId: 'WONKA' }, done)
    })
  })

  lab.test('deleteTeam should also delete descendants', (done) => {
    const parentData = {
      name: 'Team Parent',
      description: 'This is a test team for paths',
      parentId: null,
      organizationId: 'WONKA'
    }
    const childData = {
      name: 'Team Parent',
      description: 'This is a test team for paths',
      parentId: null,
      organizationId: 'WONKA'
    }

    teamOps.createTeam(parentData, (err, result) => {
      expect(err).to.not.exist()

      const parentId = result.id
      childData.parentId = parentId

      teamOps.createTeam(childData, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()

        const childId = result.id

        expect(result.path).to.equal(parentId + '.' + childId)

        teamOps.deleteTeam({ organizationId: 'WONKA', id: parentId }, (err) => {
          expect(err).to.not.exist()

          teamOps.readTeam({ id: childId, organizationId: 'WONKA' }, (err) => {
            expect(err).to.exist()
            expect(err.isBoom).to.be.true()
            expect(err.message).to.equal('Not Found')
            done()
          })
        })
      })
    })
  })

  lab.test('moveTeam should update path', (done) => {
    const parentData = {
      name: 'Team Parent',
      description: 'This is a test team for paths',
      parentId: null,
      organizationId: 'WONKA'
    }
    const childData = {
      name: 'Team Child',
      description: 'This is a test team for paths',
      parentId: null,
      organizationId: 'WONKA'
    }

    teamOps.createTeam(parentData, (err, result) => {
      expect(err).to.not.exist()

      const parentId = result.id
      childData.parentId = parentId

      teamOps.createTeam(childData, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()

        const childId = result.id

        teamOps.moveTeam({ id: parentId, parentId: 3, organizationId: 'WONKA' }, (err, result) => {
          expect(err).to.not.exist()
          expect(result).to.exist()
          expect(result.path).to.equal('3.' + parentId)

          teamOps.readTeam({id: childId, organizationId: 'WONKA'}, (err, result) => {
            expect(err).to.not.exist()
            expect(result).to.exist()
            expect(result.path).to.equal('3.' + parentId + '.' + childId)

            teamOps.deleteTeam({id: parentId, organizationId: 'WONKA'}, done)
          })
        })
      })
    })
  })

  lab.test('un-nest team', (done) => {
    const teamData = {
      name: 'Team Parent',
      description: 'This is a test team for paths',
      parentId: 1,
      organizationId: 'WONKA'
    }

    teamOps.createTeam(teamData, (err, result) => {
      expect(err).to.not.exist()

      const teamId = result.id

      expect(result.path).to.equal('1.' + teamId)

      teamOps.moveTeam({ id: teamId, parentId: null, organizationId: 'WONKA' }, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.path).to.equal(teamId.toString())

        teamOps.deleteTeam({id: teamId, organizationId: 'WONKA'}, done)
      })
    })
  })

  lab.test('replace team policies', (done) => {
    teamOps.readTeam({ id: 1, organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.policies).to.equal([{ id: 1, name: 'Director', version: '0.1' }])

      teamOps.replaceTeamPolicies({ id: 1, policies: [2, 3], organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(2)
        expect(team.policies).to.only.include([{ id: 2, name: 'Accountant', version: '0.1' }, { id: 3, name: 'Sys admin', version: '0.1' }])

        teamOps.replaceTeamPolicies({ id: 1, policies: [1], organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.not.exist()
          done()
        })
      })
    })
  })

  lab.test('add policies to team', (done) => {
    teamOps.readTeam({ id: 1, organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.policies).to.equal([{ id: 1, name: 'Director', version: '0.1' }])

      teamOps.addTeamPolicies({ id: 1, policies: [2, 3], organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(3)
        expect(team.policies).to.only.include([{ id: 1, name: 'Director', version: '0.1' }, { id: 2, name: 'Accountant', version: '0.1' }, { id: 3, name: 'Sys admin', version: '0.1' }])

        teamOps.replaceTeamPolicies({ id: 1, policies: [1], organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.not.exist()
          done()
        })
      })
    })
  })

  lab.test('delete team policies', (done) => {
    teamOps.readTeam({ id: 1, organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.policies).to.equal([{ id: 1, name: 'Director', version: '0.1' }])

      teamOps.deleteTeamPolicies({ id: 1, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.equal([])

        teamOps.replaceTeamPolicies({ id: 1, policies: [1], organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.not.exist()
          done()
        })
      })
    })
  })


  lab.test('delete specific team policy', (done) => {
    teamOps.readTeam({ id: 1, organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.policies).to.equal([{ id: 1, name: 'Director', version: '0.1' }])

      teamOps.deleteTeamPolicy({ teamId: 1, policyId: 1, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.equal([])

        teamOps.replaceTeamPolicies({ id: 1, policies: [1], organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.not.exist()
          done()
        })
      })
    })
  })

})
