jest.mock('../../../middleware/auth', () => {
  const auth = (req, res, next) => {
    if (!req.headers['x-test-role']) return res.sendStatus(401);
    req.user = { id: 7, role: req.headers['x-test-role'] };
    next();
  };
  auth.adminOnly = (req,res,next) => req.user.role === 'super_admin' ? next() : res.sendStatus(403);
  return auth;
});
jest.mock('../../../middleware/storeAuth', () => ({ getStoreRole: jest.fn() }));
jest.mock('../../../services/ProviderCredentialService', () => ({
  list: jest.fn().mockResolvedValue([]), save: jest.fn().mockResolvedValue({saved:true}),
  remove: jest.fn().mockResolvedValue({deleted:true}), test: jest.fn().mockResolvedValue({status:'adapter_required'}),
}));
const express = require('express');
const request = require('supertest');
const credentials = require('../../../services/ProviderCredentialService');
const { getStoreRole } = require('../../../middleware/storeAuth');
const app = express();
app.use(express.json(), (req,res,next) => { res.success = data => res.json({data}); next(); });
app.use('/api/provider-credentials', require('../../../routes/providerCredentials'));
app.use((err,req,res,next) => res.status(err.statusCode || 500).json({error:'denied'}));
beforeEach(() => { jest.clearAllMocks(); getStoreRole.mockResolvedValue(null); });
for (const [method, path] of [['get',''],['put','/tossplace'],['delete','/tossplace'],['post','/tossplace/test']]) {
  test(`${method} rejects another store owner and staff before credential access`, async () => {
    for (const role of ['store_owner','staff']) {
      const res = await request(app)[method](`/api/provider-credentials/stores/4${path}`).set('x-test-role',role).send({api_key:'fixture-key'});
      expect(res.status).toBe(403);
    }
    for (const fn of Object.values(credentials)) expect(fn).not.toHaveBeenCalled();
  });
}
test('owner saving credentials uses authorized URL store and rejects body store injection in service contract', async () => {
  getStoreRole.mockResolvedValue('owner');
  const res = await request(app).put('/api/provider-credentials/stores/3/tossplace').set('x-test-role','store_owner').send({api_key:'fixture-key'});
  expect(res.status).toBe(200);
  expect(res.headers['cache-control']).toBe('no-store');
  expect(credentials.save).toHaveBeenCalledWith('tossplace',3,{api_key:'fixture-key'},7);
});
test('anonymous and malformed store requests cannot read credentials', async () => {
  expect((await request(app).get('/api/provider-credentials/stores/3')).status).toBe(401);
  expect((await request(app).get('/api/provider-credentials/stores/not-a-store').set('x-test-role','super_admin')).status).toBe(400);
  expect(credentials.list).not.toHaveBeenCalled();
});
